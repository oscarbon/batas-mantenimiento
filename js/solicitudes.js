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