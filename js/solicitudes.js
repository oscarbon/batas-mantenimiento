let desperfectoSeleccionado = "";

function seleccionar(tipo,btn){

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

/* VERIFICAR SI YA EXISTE SOLICITUD PENDIENTE */

async function existeSolicitudPendiente(bata){

const {data}=await supabaseClient
.from("solicitudes")
.select("id")
.eq("bata",bata)
.eq("estado","pendiente");

return data.length>0;

}

/* ENVIAR SOLICITUD */

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

const {error}=await supabaseClient
.from("solicitudes")
.insert({
empleado,
bata,
desperfecto:desperfectoSeleccionado,
detalle,
estado:"pendiente",
temporal:false,
hora:new Date().toISOString()
});

if(error){

console.error(error);
document.getElementById("mensaje").innerText="Error al enviar";

}else{

document.getElementById("mensaje").innerText="Solicitud enviada";

}

}