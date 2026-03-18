window.enviar = async function(){

const empleado=document.getElementById("empleado").value;
const bata=document.getElementById("bata").value;
const detalle=document.getElementById("parteTela").value;

if(!empleado || !bata || !desperfectoSeleccionado){

document.getElementById("mensaje").innerText="Completa todos los campos";
return;

}

const existe=await existeSolicitudPendiente(bata);

if(existe){

document.getElementById("mensaje").innerText=
"⚠ Esta bata ya tiene una solicitud pendiente";

return;

}

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

/* 🔔 AQUI LLAMAMOS EDGE FUNCTION */

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

/* borrar mensaje después de 3 segundos */

setTimeout(()=>{
document.getElementById("mensaje").innerText="";
},3000);

/* RESET FORMULARIO */

document.getElementById("empleado").value="";
document.getElementById("bata").value="";
document.getElementById("parteTela").value="";

desperfectoSeleccionado="";

/* ocultar campo de tela */

document.getElementById("extraTela").style.display="none";

/* quitar selección de botones */

document.querySelectorAll(".opciones button")
.forEach(b=>b.classList.remove("seleccionado"));

}

}