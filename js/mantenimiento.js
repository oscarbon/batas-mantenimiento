const contenedor = document.getElementById("contenedor");
const contador = document.getElementById("contador");

/* =========================
   INVENTARIO GLOBAL
========================= */

let punos = 0;
let bordado = 0;

/* =========================
   LOGIN DIRECTO
========================= */

async function verificarUsuario(){

const user = localStorage.getItem("usuario");

if(!user){
window.location.href = "login.html";
return;
}

/* VALIDAR EN SUPABASE */

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

/* REGISTRAR ENTRADA */

registrarEntrada(user);

}

/* =========================
   REGISTRAR ENTRADA (SIN DUPLICADOS)
========================= */

async function registrarEntrada(correo){

const {data} = await supabaseClient
.from("usuarios_log")
.select("*")
.eq("correo",correo)
.is("salida",null);

if(data.length > 0) return;

await supabaseClient
.from("usuarios_log")
.insert({
correo:correo
});

}

/* =========================
   REGISTRAR SALIDA
========================= */

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

/* cerrar pestaña */
window.addEventListener("beforeunload", registrarSalida);

/* cambiar de ventana */
window.addEventListener("visibilitychange", ()=>{
if(document.visibilityState === "hidden"){
registrarSalida();
}
});

/* =========================
   LOGOUT
========================= */

window.logout = function(){

registrarSalida();

localStorage.removeItem("usuario");

window.location.href="login.html";

}

/* =========================
   UI INVENTARIO
========================= */

function actualizarInventarioUI(){

document.getElementById("contadorPunos").innerText = punos;
document.getElementById("contadorBordado").innerText = bordado;

let punosBox = document.getElementById("contadorPunos");
let bordadoBox = document.getElementById("contadorBordado");

punosBox.style.color = punos <= 50 ? "red" : "black";
bordadoBox.style.color = bordado <= 50 ? "red" : "black";

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
   BOTONES INVENTARIO
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

actualizarInventarioUI();
cargarInventario();

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
   TEMPORAL
========================= */

window.activarTemporal = async function(id){

await supabaseClient
.from("solicitudes")
.update({temporal:true})
.eq("id",Number(id));

cargarSolicitudes();

}

/* =========================
   COMPLETAR (SEGURO)
========================= */

window.completar = async function(id,tipo){

const {data} = await supabaseClient
.from("solicitudes")
.select("*")
.eq("id",Number(id))
.single();

/* DESCUENTO SEGURO */

await supabaseClient
.rpc("descontar_inventario", {
tipo: data.desperfecto
});

/* ALERTA GLOBAL */

const {data:inv}=await supabaseClient
.from("inventario")
.select("*")
.eq("id",1)
.single();

if(inv.punos <= 50){
await supabaseClient
.from("inventario")
.update({alerta_punos:true})
.eq("id",1);
}

if(inv.bordado <= 50){
await supabaseClient
.from("inventario")
.update({alerta_bordado:true})
.eq("id",1);
}

/* ACTUALIZAR SOLICITUD */

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
   INICIO
========================= */

verificarUsuario();
cargarSolicitudes();
cargarInventario();

/* =========================
   REALTIME INVENTARIO
========================= */

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

if(data.alerta_punos){
alert("⚠ Inventario de puños bajo");
}

if(data.alerta_bordado){
alert("⚠ Inventario de bordado bajo");
}

}
)
.subscribe();

/* =========================
   REALTIME SOLICITUDES
========================= */

supabaseClient
.channel("solicitudes-changes")
.on(
"postgres_changes",
{
event:"INSERT",
schema:"public",
table:"solicitudes"
},
payload=>{
cargarSolicitudes();
}
)
.subscribe();