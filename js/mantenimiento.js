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

let ayer = new Date();
ayer.setDate(ayer.getDate() - 1);

const inicio = new Date(ayer.setHours(0,0,0,0)).toISOString();
const fin = new Date(ayer.setHours(23,59,59,999)).toISOString();

const fechaAyer = inicio.split("T")[0];

const {data:datosHoy} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(datosHoy);

XLSX.utils.book_append_sheet(wb, ws, "Ayer");

XLSX.writeFile(wb, "reporte_"+fechaAyer+".xlsx");

await supabaseClient
.from("reportes_descargados")
.insert({
fecha:fechaAyer,
usuario:localStorage.getItem("usuario")
});

document.getElementById("bloqueoExcel").style.display="none";
}

/* =========================
   EXCEL HOY
========================= */

window.descargarExcelHoy = async function(){

let hoy = new Date();

const inicio = new Date(hoy.setHours(0,0,0,0)).toISOString();
const fin = new Date(hoy.setHours(23,59,59,999)).toISOString();

const fechaHoy = inicio.split("T")[0];

const {data:datosHoy, error} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

if(error){
alert("Error al obtener datos");
return;
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(datosHoy);

XLSX.utils.book_append_sheet(wb, ws, "Hoy");

XLSX.writeFile(wb, "reporte_hoy_"+fechaHoy+".xlsx");
}

/* =========================
   BLOQUEO EXCEL
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