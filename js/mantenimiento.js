const contenedor = document.getElementById("contenedor");
const contador = document.getElementById("contador");

/* =========================
   INVENTARIO GLOBAL
========================= */

let punos = 0;
let bordado = 0;

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
window.location.href="login.html";
return;
}

registrarEntrada(user);

}

/* =========================
   ADMIN
========================= */

async function verificarAdmin(){

const usuario = localStorage.getItem("usuario");

const {data} = await supabaseClient
.from("usuarios_permitidos")
.select("rol")
.eq("correo",usuario)
.single();

const btn = document.getElementById("btnExcelAdmin");

if(btn && data && data.rol === "admin"){
btn.style.display = "block";
btn.onclick = descargarExcelManual;
}

}

/* =========================
   EXCEL MANUAL ADMIN
========================= */

window.descargarExcelManual = async function(){

let hoy = new Date();

const inicio = new Date(hoy.setHours(0,0,0,0)).toISOString();
const fin = new Date(hoy.setHours(23,59,59,999)).toISOString();

const fecha = inicio.split("T")[0];

const {data,error} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

if(error){
alert("Error al generar Excel");
return;
}

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, ws, "Reporte");

XLSX.writeFile(wb, "reporte_"+fecha+".xlsx");

}

/* =========================
   LOG ENTRADA/SALIDA
========================= */

async function registrarEntrada(correo){

const {data} = await supabaseClient
.from("usuarios_log")
.select("*")
.eq("correo",correo)
.is("salida",null);

if(data.length > 0) return;

await supabaseClient.from("usuarios_log").insert({correo});

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

window.location.href="login.html";

}

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

}

/* =========================
   CARGAR INVENTARIO
========================= */

async function cargarInventario(){

const {data,error}=await supabaseClient
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

let form = document.getElementById("suministrosForm");

form.style.display =
form.style.display === "none" ? "block" : "none";

}

window.guardarSuministros = async function(){

punos = Number(document.getElementById("inputPunos").value);
bordado = Number(document.getElementById("inputBordado").value);

await supabaseClient
.from("inventario")
.update({
punos,
bordado,
alerta_punos:false,
alerta_bordado:false
})
.eq("id",1);

document.getElementById("suministrosForm").style.display="none";

}

/* =========================
   SOLICITUDES
========================= */

async function cargarSolicitudes(){

const {data,error}=await supabaseClient
.from("solicitudes")
.select("*")
.eq("estado","pendiente")
.order("hora",{ascending:true});

if(error){
console.error(error);
return;
}

contenedor.innerHTML="";
contador.innerText="Solicitudes activas: "+data.length;

data.forEach(s=>{

let card=document.createElement("div");
card.className="card";

card.innerHTML=`

<p><b>Empleado:</b> ${s.empleado}</p>
<p><b>Bata:</b> ${s.bata}</p>
<p><b>Desperfecto:</b> ${s.desperfecto}</p>

${s.desperfecto==="Tela rasgada" && s.detalle ?
`<p><b>Detalle:</b> ${s.detalle}</p>`:""}

<p><b>Hora:</b> ${new Date(s.hora).toLocaleString()}</p>

${s.temporal?

`
<button onclick="completar('${s.id}','arreglo')">Arreglo</button>
<button onclick="completar('${s.id}','cambio')">Cambio</button>
`

:

`
<button onclick="activarTemporal('${s.id}')">Temporal</button>
`
}

`;

contenedor.appendChild(card);

});

}

/* =========================
   ACCIONES
========================= */

window.activarTemporal = async function(id){

await supabaseClient
.from("solicitudes")
.update({temporal:true})
.eq("id",Number(id));

cargarSolicitudes();

}

window.completar = async function(id,tipo){

const {data} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("id",Number(id))
.single();

await supabaseClient.rpc("descontar_inventario", {
tipo: data.desperfecto
});

const {data:inv}=await supabaseClient
.from("inventario")
.select("*")
.eq("id",1)
.single();

if(inv.punos <= 50){
await supabaseClient.from("inventario").update({alerta_punos:true}).eq("id",1);
}

if(inv.bordado <= 50){
await supabaseClient.from("inventario").update({alerta_bordado:true}).eq("id",1);
}

await supabaseClient
.from("solicitudes")
.update({
estado:"completado",
resultado:tipo
})
.eq("id",Number(id));

cargarSolicitudes();

}

/* =========================
   BLOQUEO EXCEL GLOBAL
========================= */

async function verificarDescargaGlobal(){

const ahora = new Date();
if(ahora.getHours() < 5) return;

const usuario = localStorage.getItem("usuario");

let ayer = new Date();
ayer.setDate(ayer.getDate() - 1);

const fechaAyer = ayer.toISOString().split("T")[0];

const {data} = await supabaseClient
.from("reportes_descargados")
.select("*")
.eq("fecha",fechaAyer)
.eq("usuario",usuario);

if(!data || data.length === 0){
document.getElementById("bloqueoExcel").style.display="flex";
}

}

/* =========================
   DESCARGAR EXCEL OBLIGATORIO
========================= */

window.descargarExcel = async function(){

const usuario = localStorage.getItem("usuario");

/* =========================
   FECHAS
========================= */

let ayer = new Date();
ayer.setDate(ayer.getDate() - 1);

const inicio = new Date(ayer.setHours(0,0,0,0)).toISOString();
const fin = new Date(ayer.setHours(23,59,59,999)).toISOString();

const fechaAyer = inicio.split("T")[0];

/* =========================
   CONSULTA 1: HOY
========================= */

const {data:datosHoy,error:errorHoy} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

/* =========================
   CONSULTA 2: PENDIENTES
========================= */

const {data:pendientes,error:errorPendientes} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("estado","pendiente");

if(errorHoy || errorPendientes){
alert("Error al generar Excel");
console.error(errorHoy || errorPendientes);
return;
}

/* =========================
   FORMATEAR DATOS
========================= */

const formatear = (data) => data.map(s => ({
Empleado: s.empleado,
Bata: s.bata,
Desperfecto: s.desperfecto,
Detalle: s.detalle || "",
Estado: s.estado,
Fecha: new Date(s.hora).toLocaleString()
}));

const datosHoyFormateados = formatear(datosHoy);
const pendientesFormateados = formatear(pendientes);

/* =========================
   CREAR EXCEL
========================= */

const wb = XLSX.utils.book_new();

/* HOJA 1: HOY */

const wsHoy = XLSX.utils.json_to_sheet(datosHoyFormateados);
XLSX.utils.book_append_sheet(wb, wsHoy, "Hoy");

/* HOJA 2: PENDIENTES */

const wsPendientes = XLSX.utils.json_to_sheet(pendientesFormateados);
XLSX.utils.book_append_sheet(wb, wsPendientes, "Pendientes");

/* DESCARGAR */

XLSX.writeFile(wb, "reporte_"+fechaAyer+".xlsx");

/* =========================
   REGISTRAR DESCARGA
========================= */

await supabaseClient
.from("reportes_descargados")
.insert({
fecha:fechaAyer,
usuario:usuario
});

/* DESBLOQUEAR */

document.getElementById("bloqueoExcel").style.display="none";

}
/* =========================
   INICIO
========================= */

verificarUsuario();
verificarAdmin();
cargarSolicitudes();
cargarInventario();
verificarDescargaGlobal();

/* =========================
   REALTIME
========================= */

supabaseClient
.channel("solicitudes")
.on("postgres_changes",{
event:"INSERT",
schema:"public",
table:"solicitudes"
},()=>{
cargarSolicitudes();
})
.subscribe();

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

if(payload.new.alerta_punos){
alert("⚠ Inventario de puños bajo");
}

if(payload.new.alerta_bordado){
alert("⚠ Inventario de bordado bajo");
}

})
.subscribe();