const contenedor = document.getElementById("contenedor");
const contador = document.getElementById("contador");

/* INVENTARIO */

let punos = 0;
let bordado = 0;

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

let alertaPunosMostrada = false;
let alertaBordadoMostrada = false;

function actualizarInventarioUI(){

document.getElementById("contadorPunos").innerText = punos;
document.getElementById("contadorBordado").innerText = bordado;

let punosBox = document.getElementById("contadorPunos");
let bordadoBox = document.getElementById("contadorBordado");

punosBox.style.color = punos <= 50 ? "red" : "black";
bordadoBox.style.color = bordado <= 50 ? "red" : "black";

if(punos <= 50 && !alertaPunosMostrada){
alert("⚠ Inventario de puños bajo");
alertaPunosMostrada = true;
}

if(bordado <= 50 && !alertaBordadoMostrada){
alert("⚠ Inventario de bordado bajo");
alertaBordadoMostrada = true;
}

}

/* MOSTRAR / OCULTAR SUMINISTROS */

window.toggleSuministros = function(){

let form = document.getElementById("suministrosForm");

form.style.display =
form.style.display === "none" ? "block" : "none";

}

/* GUARDAR INVENTARIO */

window.guardarSuministros = async function(){

punos = Number(document.getElementById("inputPunos").value);
bordado = Number(document.getElementById("inputBordado").value);

const {error}=await supabaseClient
.from("inventario")
.update({
punos,
bordado,
alerta_punos:false,
alerta_bordado:false
})
.eq("id",1);

if(error){
console.error(error);
return;
}

alertaPunosMostrada = false;
alertaBordadoMostrada = false;

document.getElementById("suministrosForm").style.display="none";

actualizarInventarioUI();

}
/* CARGAR SOLICITUDES */

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
<button onclick="completar('${s.id}','arreglo')">
Arreglo
</button>

<button onclick="completar('${s.id}','cambio')">
Cambio
</button>
`

:

`
<button onclick="activarTemporal('${s.id}')">
Temporal
</button>
`
}

`;

contenedor.appendChild(card);

});

}

/* ACTIVAR TEMPORAL */

window.activarTemporal = async function(id){

const {error}=await supabaseClient
.from("solicitudes")
.update({temporal:true})
.eq("id",Number(id));

if(error) console.error(error);

cargarSolicitudes();

}

/* COMPLETAR SOLICITUD */

window.completar = async function(id,tipo){

const {data} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("id",Number(id))
.single();


/* DESCONTAR INVENTARIO */

if(data.desperfecto==="Puño roto"){
punos = Math.max(0,punos-1);
}

if(data.desperfecto==="Tela rasgada"){
bordado = Math.max(0,bordado-1);
}

await supabaseClient
.from("inventario")
.update({
punos,
bordado
})
.eq("id",1);

/* ALERTA GLOBAL */

if(punos <= 50){
await supabaseClient
.from("inventario")
.update({alerta_punos:true})
.eq("id",1);
}

if(bordado <= 50){
await supabaseClient
.from("inventario")
.update({alerta_bordado:true})
.eq("id",1);
}

actualizarInventarioUI();

/* ACTUALIZAR SOLICITUD */

const {error}=await supabaseClient
.from("solicitudes")
.update({
estado:"completado",
resultado:tipo
})
.eq("id",Number(id));

if(error) console.error(error);

cargarSolicitudes();

}

/* CARGA INICIAL */

cargarSolicitudes();
cargarInventario();

/* REALTIME */

supabaseClient
.channel("realtime-solicitudes")
.on(
"postgres_changes",
{
event:"INSERT",
schema:"public",
table:"solicitudes"
},
payload=>{

const s=payload.new;

if(s.estado!=="pendiente") return;

if(document.getElementById("sol_"+s.id)) return;

let card=document.createElement("div");
card.className="card";
card.id="sol_"+s.id;

card.innerHTML=`

<p><b>Empleado:</b> ${s.empleado}</p>

<p><b>Bata:</b> ${s.bata}</p>

<p><b>Desperfecto:</b> ${s.desperfecto}</p>

${s.desperfecto==="Tela rasgada" && s.detalle ?
`<p><b>Detalle:</b> ${s.detalle}</p>`:""}

<p><b>Hora:</b> ${new Date(s.hora).toLocaleString()}</p>

<button onclick="activarTemporal('${s.id}')">
Temporal
</button>

`;

contenedor.prepend(card);

let total=contenedor.children.length;
contador.innerText="Solicitudes activas: "+total;

}
)
.subscribe();


supabaseClient
.channel("inventario-changes")
.on(
"postgres_changes",
{
event:"UPDATE",
schema:"public",
table:"inventario"
},
payload=>{

const data = payload.new;

punos = data.punos;
bordado = data.bordado;

actualizarInventarioUI();

/* ALERTAS GLOBALES */

if(data.alerta_punos){
alert("⚠ Inventario de puños bajo");
}

if(data.alerta_bordado){
alert("⚠ Inventario de bordado bajo");
}

}
)
.subscribe();