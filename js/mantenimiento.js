
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
btn.onclick = descargarExcel;
}
}


/* =========================
   LOG
========================= */

async function registrarEntrada(correo){

const {data} = await supabaseClient
.from("usuarios_log")
.select("*")
.eq("correo",correo)
.is("salida",null);

if(data && data.length > 0) return;

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


/* ALERTAS */

if(punos <= 50 && !window.alertaPunos){
alert("⚠ Inventario bajo de PUÑOS");
window.alertaPunos = true;
}

if(bordado <= 50 && !window.alertaBordado){
alert("⚠ Inventario bajo de BORDADO");
window.alertaBordado = true;
}

if(punos > 50) window.alertaPunos = false;
if(bordado > 50) window.alertaBordado = false;

}


/* =========================
   INVENTARIO DB
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

actualizarInventarioUI();

}


/* =========================
   FECHAS Y FORMATO PARA EXCEL
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


/* =========================
   SOLICITUDES
========================= */

async function cargarSolicitudes(){

const contenedor = document.getElementById("contenedor");
const contador = document.getElementById("contador");

if(!contenedor || !contador){
console.error("❌ contenedor o contador no existen");
return;
}

const {data,error}=await supabaseClient
.from("solicitudes")
.select("*")
.or("estado.eq.pendiente,estado.is.null")
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

`<button class="btn btn-arreglo" onclick="completar('${s.id}','arreglo')">✔ Arreglo</button>

<button class="btn btn-cambio" onclick="completar('${s.id}','cambio')">🔄 Cambio</button>`

:

`<button class="btn btn-temporal" onclick="activarTemporal('${s.id}')">⏳ Temporal</button>`

}

<button class="btn btn-cancelar-solicitud" onclick="cancelarSolicitud('${s.id}')">
Cancelar solicitud
</button>

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


/* =========================
   CANCELAR SOLICITUD
========================= */

let solicitudPorCancelar = null;

window.cancelarSolicitud = function(id){

solicitudPorCancelar = Number(id);

document.getElementById("razonCancelacion").value = "";
document.getElementById("modalCancelar").style.display = "flex";
document.getElementById("razonCancelacion").focus();

};


window.cerrarModalCancelar = function(){

document.getElementById("modalCancelar").style.display = "none";
document.getElementById("razonCancelacion").value = "";
solicitudPorCancelar = null;

};


window.confirmarCancelacion = async function(){

if(solicitudPorCancelar === null) return;

const motivo = document
.getElementById("razonCancelacion")
.value
.trim();

if(!motivo){
alert("Escribe el motivo de la cancelación.");
return;
}

if(window.procesandoCancelacion) return;

window.procesandoCancelacion = true;

const id = solicitudPorCancelar;

try{

const {data,error} = await supabaseClient
.from("solicitudes")
.update({
estado:"cancelado",
razon_cancelacion:motivo
})
.eq("id",id)
.or("estado.eq.pendiente,estado.is.null")
.select("id");

if(error){
console.error(error);
alert("No se pudo cancelar la solicitud. Verifica que exista la columna razon_cancelacion en Supabase.");
return;
}

if(!data || data.length === 0){
alert("La solicitud ya fue procesada o ya no está pendiente.");
await cargarSolicitudes();
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

window.completar = async function(id, tipo){

if(window.procesando) return;

window.procesando = true;

try{

const {data, error} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("id", Number(id))
.single();

if(error || !data){
alert("Error al obtener solicitud");
window.procesando = false;
return;
}

if(data.estado !== "pendiente"){
alert("Esta solicitud ya fue procesada");
window.procesando = false;
cargarSolicitudes();
return;
}

await supabaseClient.rpc("descontar_inventario", {
tipo: data.desperfecto
});

await supabaseClient
.from("solicitudes")
.update({
estado:"completado",
resultado:tipo
})
.eq("id", Number(id))
.eq("estado","pendiente");

cargarSolicitudes();

}catch(e){

console.error(e);
alert("Error inesperado");

}

window.procesando = false;

}


/* =========================
   EXCEL AYER
========================= */

window.descargarExcel = async function(){

const usuario = localStorage.getItem("usuario");

/* FECHA AYER */

let ayer = new Date();

ayer.setDate(ayer.getDate() - 1);

const fechaAyer = fechaLocalISO(ayer);

let fechaInicio = new Date(ayer);
fechaInicio.setHours(0,0,0,0);

let fechaFin = new Date(ayer);
fechaFin.setHours(23,59,59,999);

const inicio = fechaInicio.toISOString();
const fin = fechaFin.toISOString();


/* CONSULTAS */

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


/* FORMATO */

const formatear = (data) => (data || []).map(s => ({

Empleado: s.empleado,
Bata: s.bata,
Desperfecto: s.desperfecto,
Detalle: s.detalle || "",
Estado: estadoParaExcel(s.estado),
Fecha: new Date(s.hora).toLocaleString(),
MotivoCancelacion: s.razon_cancelacion || ""

}));


const hoyData = formatear(datosHoy);
const pendientesData = formatear(pendientes);


/* RESUMEN */

const resumen = [

{Tipo:"Puño roto", Cantidad:hoyData.filter(d=>d.Desperfecto==="Puño roto").length},

{Tipo:"Tela rasgada", Cantidad:hoyData.filter(d=>d.Desperfecto==="Tela rasgada").length},

{Tipo:"Botones", Cantidad:hoyData.filter(d=>d.Desperfecto==="Botones").length},

{Tipo:"Pendientes", Cantidad:pendientesData.filter(d=>d.Estado==="pendiente").length},

{Tipo:"Canceladas", Cantidad:hoyData.filter(d=>d.Estado==="Cancelada").length},

{Tipo:"TOTAL", Cantidad:hoyData.length}

];


/* CREAR EXCEL */

const wb = XLSX.utils.book_new();


/* RESUMEN */

const wsResumen = XLSX.utils.json_to_sheet(resumen);

wsResumen["!cols"] = [
{wch:25},
{wch:15}
];

["A1","B1"].forEach(c=>{

if(wsResumen[c]){

wsResumen[c].s = {
fill:{ fgColor:{ rgb:"2ECC71"}},
font:{ bold:true, color:{ rgb:"FFFFFF"}}
};

}

});


/* HOJA HOY */

const wsHoy = XLSX.utils.json_to_sheet(hoyData);

wsHoy["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:20},
{wch:40}
];

wsHoy["!autofilter"] = { ref: "A1:G1" };

["A1","B1","C1","D1","E1","F1","G1"].forEach(c=>{

if(wsHoy[c]){

wsHoy[c].s = {
fill:{ fgColor:{ rgb:"4F81BD"}},
font:{ bold:true, color:{ rgb:"FFFFFF"}}
};

}

});


/* HOJA PENDIENTES */

const wsPendientes = XLSX.utils.json_to_sheet(pendientesData);

wsPendientes["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:20},
{wch:40}
];

wsPendientes["!autofilter"] = { ref: "A1:G1" };

pendientesData.forEach((_, i)=>{

const row = i + 2;

["A","B","C","D","E","F","G"].forEach(col=>{

const cell = wsPendientes[col + row];

if(cell){

cell.s = {
fill:{ fgColor:{ rgb:"FFCCCC"}}
};

}

});

});


/* AGREGAR HOJAS */

XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
XLSX.utils.book_append_sheet(wb, wsHoy, "Hoy");
XLSX.utils.book_append_sheet(wb, wsPendientes, "Pendientes");


/* DESCARGAR */

XLSX.writeFile(wb, "reporte_"+fechaAyer+".xlsx");


/* REGISTRAR DESCARGA */

const {error:errorRegistro} = await supabaseClient
.from("reportes_descargados")
.insert({
fecha:fechaAyer,
usuario:usuario
});

if(errorRegistro){
console.error("Error al registrar la descarga:",errorRegistro);
}


/* DESBLOQUEAR */

document.getElementById("bloqueoExcel").style.display="none";

};


/* =========================
   EXCEL HOY
========================= */

window.descargarExcelHoy = async function(){

let hoy = new Date();

let fechaInicio = new Date(hoy);
fechaInicio.setHours(0,0,0,0);

let fechaFin = new Date(hoy);
fechaFin.setHours(23,59,59,999);

const inicio = fechaInicio.toISOString();
const fin = fechaFin.toISOString();

const fechaHoy = fechaLocalISO(hoy);


/* CONSULTAS */

const {data:datosHoy, error} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

const {data:pendientes,error:errorPendientes} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("estado","pendiente");

if(error || errorPendientes){

console.error(error || errorPendientes);
alert("Error al obtener datos");

return;

}


/* FORMATEO */

const formatear = (data) => (data || []).map(s => ({

Empleado: s.empleado,
Bata: s.bata,
Desperfecto: s.desperfecto,
Detalle: s.detalle || "",
Resultado: s.resultado || "",
Estado: estadoParaExcel(s.estado),
Fecha: new Date(s.hora).toLocaleString(),
MotivoCancelacion: s.razon_cancelacion || ""

}));


const hoyData = formatear(datosHoy);
const pendientesData = formatear(pendientes);


/* CREAR EXCEL */

const wb = XLSX.utils.book_new();


/* HOJA HOY */

const wsHoy = XLSX.utils.json_to_sheet(hoyData);

wsHoy["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:15},
{wch:20},
{wch:40}
];

wsHoy["!autofilter"] = { ref: "A1:H1" };


/* HOJA PENDIENTES */

const wsPendientes = XLSX.utils.json_to_sheet(pendientesData);

wsPendientes["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:15},
{wch:20},
{wch:40}
];

wsPendientes["!autofilter"] = { ref: "A1:H1" };


/* AGREGAR HOJAS */

XLSX.utils.book_append_sheet(wb, wsHoy, "Hoy");
XLSX.utils.book_append_sheet(wb, wsPendientes, "Pendientes");


/* DESCARGAR */

XLSX.writeFile(wb, "reporte_hoy_"+fechaHoy+".xlsx");

};


/* =========================
   EXCEL ÚLTIMAS 4 SEMANAS
========================= */

window.descargarExcelTresSemanas = async function(){

let hoy = new Date();


/* FECHA INICIO: HACE 28 DÍAS */

let fechaInicio = new Date(hoy);

fechaInicio.setDate(fechaInicio.getDate() - 28);

fechaInicio.setHours(0,0,0,0);


/* FECHA FINAL: HOY */

let fechaFin = new Date(hoy);

fechaFin.setHours(23,59,59,999);


const inicio = fechaInicio.toISOString();
const fin = fechaFin.toISOString();


/* CONSULTAR SOLICITUDES */

const {data, error} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin)
.order("hora",{ascending:false});


if(error){

console.error(error);
alert("Error al obtener las solicitudes");
return;

}


/* FORMATEAR */

const solicitudesData = (data || []).map(s => ({

Empleado: s.empleado,
Bata: s.bata,
Desperfecto: s.desperfecto,
Detalle: s.detalle || "",
Resultado: s.resultado || "",
Estado: estadoParaExcel(s.estado),
Fecha: new Date(s.hora).toLocaleString(),
MotivoCancelacion: s.razon_cancelacion || ""

}));


/* CREAR EXCEL */

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(solicitudesData);


/* ANCHO DE COLUMNAS */

ws["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:15},
{wch:20},
{wch:40}
];


/* FILTRO */

ws["!autofilter"] = { ref:"A1:H1" };


/* AGREGAR HOJA */

XLSX.utils.book_append_sheet(wb,ws,"Solicitudes");


/* NOMBRE DEL ARCHIVO */

const fechaHoy = fechaLocalISO(hoy);

XLSX.writeFile(
wb,
"solicitudes_ultimas_4_semanas_"+fechaHoy+".xlsx"
);

};


/* =========================
   BLOQUEO EXCEL
========================= */

async function verificarDescargaGlobal(){

const ahora = new Date();

if(ahora.getHours() < 5) return;

const usuario = localStorage.getItem("usuario");

let ayer = new Date();
ayer.setDate(ayer.getDate() - 1);

const fechaAyer = fechaLocalISO(ayer);

const {data,error} = await supabaseClient
.from("reportes_descargados")
.select("fecha,usuario")
.eq("fecha",fechaAyer)
.eq("usuario",usuario);

if(error){
console.error("Error al verificar la descarga del Excel:",error);
alert("No se pudo verificar la descarga del Excel. Recarga la página o contacta al administrador.");
return;
}

if(!data || data.length === 0){
document.getElementById("bloqueoExcel").style.display="flex";
}

}


/* =========================
   INICIO
========================= */

window.addEventListener("DOMContentLoaded", async () => {

await verificarUsuario();

await verificarAdmin();

await cargarInventario();

await cargarSolicitudes();

await verificarDescargaGlobal();

});


/* =========================
   REALTIME
========================= */

supabaseClient
.channel("solicitudes")
.on("postgres_changes",{
event:"*",
schema:"public",
table:"solicitudes"
},()=>{
console.log("🔄 Actualización realtime");
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
})
.subscribe();
