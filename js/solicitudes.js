/* =========================
   VARIABLE GLOBAL
========================= */

window.desperfectoSeleccionado = "";

/* =========================
   SELECCIONAR DESPERFECTO
========================= */

window.seleccionar = function(tipo,btn){

desperfectoSeleccionado = tipo;

document.querySelectorAll(".opciones button")
.forEach(b=>b.classList.remove("seleccionado"));

btn.classList.add("seleccionado");

if(tipo==="Tela rasgada"){
document.getElementById("extraTela").style.display="block";
}else{
document.getElementById("extraTela").style.display="none";
}

}

/* =========================
   📊 EXCEL HOY USUARIO (MISMO FORMATO)
========================= */

window.descargarExcelHoyUsuario = async function(){

let hoy = new Date();

const inicio = new Date(hoy.setHours(0,0,0,0)).toISOString();
const fin = new Date(hoy.setHours(23,59,59,999)).toISOString();

const fechaHoy = inicio.split("T")[0];

/* CONSULTAS */

const {data:datosHoy, error} = await supabaseClient
.from("solicitudes")
.select("*")
.gte("hora",inicio)
.lte("hora",fin);

const {data:pendientes} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("estado","pendiente");

if(error){
alert("Error al obtener datos");
return;
}

/* =========================
   FORMATO (IGUAL QUE MANTENIMIENTO)
========================= */

const formatear = (data) => data.map(s => ({
Empleado: s.empleado,
Bata: s.bata,
Desperfecto: s.desperfecto,
Detalle: s.detalle || "",
Resultado: s.resultado || (s.temporal ? "En proceso" : ""),
Estado: s.estado,
Fecha: new Date(s.hora).toLocaleString()
}));

const hoyData = formatear(datosHoy);
const pendientesData = formatear(pendientes);

/* =========================
   CREAR EXCEL
========================= */

const wb = XLSX.utils.book_new();

/* ===== HOY ===== */

const wsHoy = XLSX.utils.json_to_sheet(hoyData);

wsHoy["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:15},
{wch:20}
];

wsHoy["!autofilter"] = { ref: "A1:G1" };

/* ===== PENDIENTES ===== */

const wsPendientes = XLSX.utils.json_to_sheet(pendientesData);

wsPendientes["!cols"] = [
{wch:15},
{wch:10},
{wch:20},
{wch:25},
{wch:15},
{wch:15},
{wch:20}
];

wsPendientes["!autofilter"] = { ref: "A1:G1" };

/* =========================
   AGREGAR HOJAS
========================= */

XLSX.utils.book_append_sheet(wb, wsHoy, "Hoy");
XLSX.utils.book_append_sheet(wb, wsPendientes, "Pendientes");

/* =========================
   DESCARGAR
========================= */

XLSX.writeFile(wb, "estado_solicitudes_hoy_"+fechaHoy+".xlsx");

}
/* =========================
   VALIDAR DUPLICADOS
========================= */

window.existeSolicitudPendiente = async function(bata){

const {data,error}=await supabaseClient
.from("solicitudes")
.select("id")
.eq("bata",bata)
.eq("estado","pendiente");

if(error){
console.error(error);
return false;
}

return data.length > 0;

}

/* =========================
   ENVIAR SOLICITUD
========================= */

window.enviar = async function(){

const empleado=document.getElementById("empleado").value;
const bata=document.getElementById("bata").value;
const detalle=document.getElementById("parteTela").value;

if(!empleado || !bata || !desperfectoSeleccionado){

document.getElementById("mensaje").innerText="Completa todos los campos";
return;

}

/* VALIDAR DUPLICADO */

const existe=await existeSolicitudPendiente(bata);

if(existe){

document.getElementById("mensaje").innerText=
"⚠ Esta bata ya tiene una solicitud pendiente";

return;

}

/* INSERTAR EN SUPABASE */

const {data,error}=await supabaseClient
.from("solicitudes")
.insert({
empleado,
bata,
desperfecto:desperfectoSeleccionado,
detalle,
estado:"pendiente",
temporal:false,
hora:new Date().toISOString()
})
.select()
.single();

if(error){

console.error(error);
document.getElementById("mensaje").innerText="Error al enviar";

}else{

document.getElementById("mensaje").innerText="Solicitud enviada ✔";

/* =========================
   🔔 LLAMAR EDGE FUNCTION
========================= */

try{

await fetch("https://uatbsgnqgpklugtwqbjh.functions.supabase.co/notificar", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
empleado: data.empleado,
bata: data.bata,
desperfecto: data.desperfecto,
detalle: data.detalle
})
});

}catch(e){
console.error("Error enviando correo:", e);
}

/* =========================
   LIMPIAR FORMULARIO
========================= */

setTimeout(()=>{
document.getElementById("mensaje").innerText="";
},3000);

document.getElementById("empleado").value="";
document.getElementById("bata").value="";
document.getElementById("parteTela").value="";

desperfectoSeleccionado="";

/* ocultar campo */

document.getElementById("extraTela").style.display="none";

/* quitar selección */

document.querySelectorAll(".opciones button")
.forEach(b=>b.classList.remove("seleccionado"));

}

}