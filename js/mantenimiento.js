
/* =========================
   INVENTARIO GLOBAL
========================= */

let punos = 0;
let bordado = 0;


/* =========================
   FECHAS Y ESTADOS
========================= */

function fechaLocalISO(fecha){
  return [
    fecha.getFullYear(),
    String(fecha.getMonth()+1).padStart(2,"0"),
    String(fecha.getDate()).padStart(2,"0")
  ].join("-");
}

function estadoParaExcel(estado){
  if(estado === "cancelado") return "Cancelada";
  return estado || "";
}

function formatearSolicitudes(data, incluirResultado = false){
  return (data || []).map(s => {
    const registro = {
      Empleado: s.empleado,
      Bata: s.bata,
      Desperfecto: s.desperfecto,
      Detalle: s.detalle || ""
    };

    if(incluirResultado){
      registro.Resultado = s.resultado || "";
    }

    registro.Estado = estadoParaExcel(s.estado);
    registro.Fecha = new Date(s.hora).toLocaleString();
    registro.MotivoCancelacion = s.razon_cancelacion || "";

    return registro;
  });
}


/* =========================
   LOGIN
========================= */

async function verificarUsuario(){

  const user = localStorage.getItem("usuario");

  if(!user){
    window.location.href = "login.html";
    return;
  }

  const {data,error} = await supabaseClient
    .from("usuarios_permitidos")
    .select("*")
    .eq("correo",user)
    .single();

  if(error || !data){
    localStorage.removeItem("usuario");
    window.location.href = "login.html";
    return;
  }

  await registrarEntrada(user);
}


/* =========================
   ADMIN
========================= */

async function verificarAdmin(){

  const usuario = localStorage.getItem("usuario");

  const {data,error} = await supabaseClient
    .from("usuarios_permitidos")
    .select("rol")
    .eq("correo",usuario)
    .single();

  if(error){
    console.error(error);
    return;
  }

  const btn = document.getElementById("btnExcelAdmin");

  if(btn && data && data.rol === "admin"){
    btn.style.display = "block";
    btn.onclick = window.descargarExcel;
  }
}


/* =========================
   LOG
========================= */

async function registrarEntrada(correo){

  const {data,error} = await supabaseClient
    .from("usuarios_log")
    .select("*")
    .eq("correo",correo)
    .is("salida",null);

  if(error){
    console.error(error);
    return;
  }

  if(data && data.length > 0) return;

  const {error:insertError} = await supabaseClient
    .from("usuarios_log")
    .insert({correo});

  if(insertError) console.error(insertError);
}


async function registrarSalida(){

  const user = localStorage.getItem("usuario");

  if(user){
    await supabaseClient
      .from("usuarios_log")
      .update({salida:new Date()})
      .eq("correo",user)
      .is("salida",null);
  }
}

window.addEventListener("beforeunload", registrarSalida);


/* =========================
   LOGOUT
========================= */

window.logout = function(){
  registrarSalida();
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
};


/* =========================
   INVENTARIO UI
========================= */

function actualizarInventarioUI(){

  document.getElementById("contadorPunos").innerText = punos;
  document.getElementById("contadorBordado").innerText = bordado;

  document.getElementById("contadorPunos").style.color =
    punos <= 50 ? "red" : "black";

  document.getElementById("contadorBordado").style.color =
    bordado <= 50 ? "red" : "black";

  if(punos <= 50 && !window.alertaPunos){
    alert("Inventario bajo de PUÑOS");
    window.alertaPunos = true;
  }

  if(bordado <= 50 && !window.alertaBordado){
    alert("Inventario bajo de BORDADO");
    window.alertaBordado = true;
  }

  if(punos > 50) window.alertaPunos = false;
  if(bordado > 50) window.alertaBordado = false;
}


/* =========================
   INVENTARIO DB
========================= */

async function cargarInventario(){

  const {data,error} = await supabaseClient
    .from("inventario")
    .select("*")
    .eq("id",1)
    .single();

  if(error){
    console.error(error);
    return;
  }

  punos = data.punos;
  bordado = data.bordado;

  actualizarInventarioUI();
}


/* =========================
   SUMINISTROS
========================= */

window.toggleSuministros = function(){

  const form = document.getElementById("suministrosForm");

  form.style.display =
    form.style.display === "none" ? "block" : "none";
};


window.guardarSuministros = async function(){

  const nuevosPunos = Number(document.getElementById("inputPunos").value);
  const nuevoBordado = Number(document.getElementById("inputBordado").value);

  const {error} = await supabaseClient
    .from("inventario")
    .update({
      punos: nuevosPunos,
      bordado: nuevoBordado,
      alerta_punos: false,
      alerta_bordado: false
    })
    .eq("id",1);

  if(error){
    console.error(error);
    alert("No se pudo actualizar el inventario.");
    return;
  }

  punos = nuevosPunos;
  bordado = nuevoBordado;

  document.getElementById("suministrosForm").style.display = "none";

  actualizarInventarioUI();
};


/* =========================
   SOLICITUDES
========================= */

async function cargarSolicitudes(){

  const contenedor = document.getElementById("contenedor");
  const contador = document.getElementById("contador");

  if(!contenedor || !contador){
    console.error("El contenedor o contador no existen.");
    return;
  }

  const {data,error} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .or("estado.eq.pendiente,estado.is.null")
    .order("hora",{ascending:true});

  if(error){
    console.error(error);
    return;
  }

  contenedor.innerHTML = "";
  contador.innerText = "Solicitudes activas: " + data.length;

  data.forEach(s => {

    const card = document.createElement("div");
    card.className = "card";

    const detalle = s.desperfecto === "Tela rasgada" && s.detalle
      ? `<p><b>Detalle:</b> ${s.detalle}</p>`
      : "";

    const botones = s.temporal
      ? `<button class="btn btn-arreglo" onclick="completar('${s.id}','arreglo')">✔ Arreglo</button>
         <button class="btn btn-cambio" onclick="completar('${s.id}','cambio')">Cambio</button>`
      : `<button class="btn btn-temporal" onclick="activarTemporal('${s.id}')">Temporal</button>`;

    card.innerHTML = `
      <p><b>Empleado:</b> ${s.empleado}</p>
      <p><b>Bata:</b> ${s.bata}</p>
      <p><b>Desperfecto:</b> ${s.desperfecto}</p>
      ${detalle}
      <p><b>Hora:</b> ${new Date(s.hora).toLocaleString()}</p>
      ${botones}
      <button class="btn btn-cancelar-solicitud"
        onclick="cancelarSolicitud('${s.id}')">
        Cancelar solicitud
      </button>
    `;

    contenedor.appendChild(card);
  });
}


/* =========================
   ACTIVAR TEMPORAL
========================= */

window.activarTemporal = async function(id){

  const {error} = await supabaseClient
    .from("solicitudes")
    .update({temporal:true})
    .eq("id",Number(id))
    .eq("estado","pendiente");

  if(error){
    console.error(error);
    alert("No se pudo activar el temporal.");
    return;
  }

  await cargarSolicitudes();
};


/* =========================
   CANCELAR SOLICITUD
========================= */

let solicitudPorCancelar = null;

window.cancelarSolicitud = function(id){

  solicitudPorCancelar = Number(id);

  const modal = document.getElementById("modalCancelar");
  const razon = document.getElementById("razonCancelacion");

  if(!modal || !razon){
    alert("No se encontró la ventana de cancelación en el HTML.");
    return;
  }

  razon.value = "";
  modal.style.display = "flex";
  razon.focus();
};


window.cerrarModalCancelar = function(){

  const modal = document.getElementById("modalCancelar");
  const razon = document.getElementById("razonCancelacion");

  if(modal) modal.style.display = "none";
  if(razon) razon.value = "";

  solicitudPorCancelar = null;
};


window.confirmarCancelacion = async function(){

  if(solicitudPorCancelar === null) return;

  const razon = document.getElementById("razonCancelacion");
  const motivo = razon.value.trim();

  if(!motivo){
    alert("Escribe el motivo de la cancelación.");
    razon.focus();
    return;
  }

  if(window.procesandoCancelacion) return;

  window.procesandoCancelacion = true;

  const id = solicitudPorCancelar;

  try{

    const {data,error} = await supabaseClient
      .from("solicitudes")
      .update({
        estado: "cancelado",
        razon_cancelacion: motivo
      })
      .eq("id",id)
      .or("estado.eq.pendiente,estado.is.null")
      .select("id");

    if(error){
      console.error(error);
      alert("No se pudo cancelar. Verifica la columna razon_cancelacion en Supabase.");
      return;
    }

    if(!data || data.length === 0){
      alert("La solicitud ya fue procesada o ya no está pendiente.");
      await cargarSolicitudes();
      window.cerrarModalCancelar();
      return;
    }

    window.cerrarModalCancelar();
    await cargarSolicitudes();

  }catch(e){

    console.error(e);
    alert("Ocurrió un error al cancelar la solicitud.");

  }finally{

    window.procesandoCancelacion = false;

  }
};


/* =========================
   COMPLETAR SOLICITUD
========================= */

window.completar = async function(id,tipo){

  if(window.procesando) return;

  window.procesando = true;

  try{

    const {data,error} = await supabaseClient
      .from("solicitudes")
      .select("*")
      .eq("id",Number(id))
      .single();

    if(error || !data){
      alert("Error al obtener la solicitud.");
      return;
    }

    if(data.estado !== "pendiente"){
      alert("Esta solicitud ya fue procesada.");
      await cargarSolicitudes();
      return;
    }

    const {error:errorInventario} = await supabaseClient.rpc(
      "descontar_inventario",
      {tipo:data.desperfecto}
    );

    if(errorInventario){
      console.error(errorInventario);
      alert("No se pudo descontar el inventario.");
      return;
    }

    const {error:errorActualizar} = await supabaseClient
      .from("solicitudes")
      .update({
        estado:"completado",
        resultado:tipo
      })
      .eq("id",Number(id))
      .eq("estado","pendiente");

    if(errorActualizar){
      console.error(errorActualizar);
      alert("No se pudo actualizar la solicitud.");
      return;
    }

    await cargarSolicitudes();

  }catch(e){

    console.error(e);
    alert("Error inesperado.");

  }finally{

    window.procesando = false;

  }
};


/* =========================
   EXCEL AYER - ADMIN
========================= */

window.descargarExcel = async function(){

  const usuario = localStorage.getItem("usuario");

  const ayer = new Date();
  ayer.setDate(ayer.getDate()-1);

  const fechaAyer = fechaLocalISO(ayer);

  const fechaInicio = new Date(ayer);
  fechaInicio.setHours(0,0,0,0);

  const fechaFin = new Date(ayer);
  fechaFin.setHours(23,59,59,999);

  const inicio = fechaInicio.toISOString();
  const fin = fechaFin.toISOString();

  const {data:datosHoy,error:errorHoy} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .gte("hora",inicio)
    .lte("hora",fin);

  const {data:pendientes,error:errorPendientes} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .eq("estado","pendiente");

  if(errorHoy || errorPendientes){
    console.error(errorHoy || errorPendientes);
    alert("Error al obtener los datos del Excel.");
    return;
  }

  const hoyData = formatearSolicitudes(datosHoy);
  const pendientesData = formatearSolicitudes(pendientes);

  const resumen = [
    {Tipo:"Puño roto",Cantidad:hoyData.filter(d=>d.Desperfecto==="Puño roto").length},
    {Tipo:"Tela rasgada",Cantidad:hoyData.filter(d=>d.Desperfecto==="Tela rasgada").length},
    {Tipo:"Botones",Cantidad:hoyData.filter(d=>d.Desperfecto==="Botones").length},
    {Tipo:"Pendientes",Cantidad:pendientesData.length},
    {Tipo:"Canceladas",Cantidad:hoyData.filter(d=>d.Estado==="Cancelada").length},
    {Tipo:"TOTAL",Cantidad:hoyData.length}
  ];

  const wb = XLSX.utils.book_new();

  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen["!cols"] = [{wch:25},{wch:15}];

  const wsHoy = XLSX.utils.json_to_sheet(hoyData);
  wsHoy["!cols"] = [
    {wch:15},{wch:10},{wch:20},{wch:25},
    {wch:15},{wch:20},{wch:40}
  ];
  if(wsHoy["!ref"]) wsHoy["!autofilter"] = {ref:wsHoy["!ref"]};

  const wsPendientes = XLSX.utils.json_to_sheet(pendientesData);
  wsPendientes["!cols"] = [
    {wch:15},{wch:10},{wch:20},{wch:25},
    {wch:15},{wch:20},{wch:40}
  ];
  if(wsPendientes["!ref"]) wsPendientes["!autofilter"] = {ref:wsPendientes["!ref"]};

  XLSX.utils.book_append_sheet(wb,wsResumen,"Resumen");
  XLSX.utils.book_append_sheet(wb,wsHoy,"Hoy");
  XLSX.utils.book_append_sheet(wb,wsPendientes,"Pendientes");

  XLSX.writeFile(wb,"reporte_"+fechaAyer+".xlsx");

  const {error:errorRegistro} = await supabaseClient
    .from("reportes_descargados")
    .insert({
      fecha:fechaAyer,
      usuario:usuario
    });

  if(errorRegistro){
    console.error("Error al registrar la descarga:",errorRegistro);
    alert("El Excel se descargó, pero no se pudo registrar la descarga en el sistema.");
    return;
  }

  const bloqueo = document.getElementById("bloqueoExcel");
  if(bloqueo) bloqueo.style.display = "none";
};


/* =========================
   EXCEL HOY
========================= */

window.descargarExcelHoy = async function(){

  const hoy = new Date();

  const fechaInicio = new Date(hoy);
  fechaInicio.setHours(0,0,0,0);

  const fechaFin = new Date(hoy);
  fechaFin.setHours(23,59,59,999);

  const fechaHoy = fechaLocalISO(hoy);

  const {data:datosHoy,error} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .gte("hora",fechaInicio.toISOString())
    .lte("hora",fechaFin.toISOString());

  const {data:pendientes,error:errorPendientes} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .eq("estado","pendiente");

  if(error || errorPendientes){
    console.error(error || errorPendientes);
    alert("Error al obtener datos.");
    return;
  }

  const hoyData = formatearSolicitudes(datosHoy,true);
  const pendientesData = formatearSolicitudes(pendientes,true);

  const wb = XLSX.utils.book_new();

  const wsHoy = XLSX.utils.json_to_sheet(hoyData);
  wsHoy["!cols"] = [
    {wch:15},{wch:10},{wch:20},{wch:25},
    {wch:15},{wch:15},{wch:20},{wch:40}
  ];
  if(wsHoy["!ref"]) wsHoy["!autofilter"] = {ref:wsHoy["!ref"]};

  const wsPendientes = XLSX.utils.json_to_sheet(pendientesData);
  wsPendientes["!cols"] = [
    {wch:15},{wch:10},{wch:20},{wch:25},
    {wch:15},{wch:15},{wch:20},{wch:40}
  ];
  if(wsPendientes["!ref"]) wsPendientes["!autofilter"] = {ref:wsPendientes["!ref"]};

  XLSX.utils.book_append_sheet(wb,wsHoy,"Hoy");
  XLSX.utils.book_append_sheet(wb,wsPendientes,"Pendientes");

  XLSX.writeFile(wb,"reporte_hoy_"+fechaHoy+".xlsx");
};


/* =========================
   EXCEL ÚLTIMAS 4 SEMANAS
========================= */

window.descargarExcelTresSemanas = async function(){

  const hoy = new Date();

  const fechaInicio = new Date(hoy);
  fechaInicio.setDate(fechaInicio.getDate()-28);
  fechaInicio.setHours(0,0,0,0);

  const fechaFin = new Date(hoy);
  fechaFin.setHours(23,59,59,999);

  const {data,error} = await supabaseClient
    .from("solicitudes")
    .select("*")
    .gte("hora",fechaInicio.toISOString())
    .lte("hora",fechaFin.toISOString())
    .order("hora",{ascending:false});

  if(error){
    console.error(error);
    alert("Error al obtener las solicitudes.");
    return;
  }

  const solicitudesData = formatearSolicitudes(data,true);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(solicitudesData);

  ws["!cols"] = [
    {wch:15},{wch:10},{wch:20},{wch:25},
    {wch:15},{wch:15},{wch:20},{wch:40}
  ];

  if(ws["!ref"]) ws["!autofilter"] = {ref:ws["!ref"]};

  XLSX.utils.book_append_sheet(wb,ws,"Solicitudes");

  XLSX.writeFile(
    wb,
    "solicitudes_ultimas_4_semanas_"+fechaLocalISO(hoy)+".xlsx"
  );
};


/* =========================
   BLOQUEO EXCEL
========================= */

async function verificarDescargaGlobal(){

  const ahora = new Date();

  if(ahora.getHours() < 5) return;

  const usuario = localStorage.getItem("usuario");

  if(!usuario){
    console.error("No se encontró el usuario de la sesión.");
    return;
  }

  const ayer = new Date();
  ayer.setDate(ayer.getDate()-1);

  const fechaAyer = fechaLocalISO(ayer);

  const {data,error} = await supabaseClient
    .from("reportes_descargados")
    .select("id")
    .eq("fecha",fechaAyer)
    .eq("usuario",usuario);

  if(error){
    console.error("Error al verificar la descarga:",error);
    alert("No se pudo verificar la descarga del Excel. Intenta recargar la página.");
    return;
  }

  const bloqueo = document.getElementById("bloqueoExcel");

  if(!bloqueo) return;

  if(!data || data.length===0){
    bloqueo.style.display = "flex";
  }else{
    bloqueo.style.display = "none";
  }
}


/* =========================
   INICIO
========================= */

window.addEventListener("DOMContentLoaded",async()=>{

  await verificarUsuario();

  if(!localStorage.getItem("usuario")) return;

  await verificarAdmin();
  await cargarInventario();
  await cargarSolicitudes();
  await verificarDescargaGlobal();

});


/* =========================
   REALTIME SOLICITUDES
========================= */

supabaseClient
  .channel("solicitudes")
  .on("postgres_changes",{
    event:"*",
    schema:"public",
    table:"solicitudes"
  },()=>{
    console.log("Actualización realtime");
    cargarSolicitudes();
  })
  .subscribe();


/* =========================
   REALTIME INVENTARIO
========================= */

supabaseClient
  .channel("inventario")
  .on("postgres_changes",{
    event:"UPDATE",
    schema:"public",
    table:"inventario"
  },payload=>{
    punos = payload.new.punos;
    bordado = payload.new.bordado;
    actualizarInventarioUI();
  })
  .subscribe();
