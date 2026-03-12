let desperfectoSeleccionado="";

function seleccionar(tipo,boton){

desperfectoSeleccionado=tipo;

document.querySelectorAll(".opciones button").forEach(b=>{
b.classList.remove("seleccionado");
});

boton.classList.add("seleccionado");

document.getElementById("extraTela").style.display=
(tipo==="Tela rasgada")?"block":"none";

}

async function enviar(){

let empleado=document.getElementById("empleado").value.trim();
let bata=document.getElementById("bata").value.trim();
let parteTela=document.getElementById("parteTela").value.trim();

if(!empleado||!bata||!desperfectoSeleccionado){
alert("Completa todos los campos");
return;
}

if(desperfectoSeleccionado==="Tela rasgada" && !parteTela){
alert("Especifica qué parte se rasgó");
return;
}

let fecha=new Date().toISOString();

let solicitud={
empleado,
bata,
desperfecto:desperfectoSeleccionado,
detalle:parteTela,
hora:fecha,
estado:"pendiente",
temporal:false
};

/* EVITAR DUPLICADOS */

const {data:existente}=await supabaseClient
.from("solicitudes")
.select("*")
.eq("bata",bata)
.eq("desperfecto",desperfectoSeleccionado)
.eq("estado","pendiente");

if(existente.length>0){

alert("Ya existe una solicitud para esta bata con ese desperfecto");
return;

}

/* INSERTAR */

const {error}=await supabaseClient
.from("solicitudes")
.insert([solicitud]);

if(error){

alert("Error al enviar solicitud");
console.log(error);
return;

}

document.getElementById("mensaje").innerText="Solicitud enviada correctamente";

document.getElementById("empleado").value="";
document.getElementById("bata").value="";
document.getElementById("parteTela").value="";
document.getElementById("extraTela").style.display="none";

}