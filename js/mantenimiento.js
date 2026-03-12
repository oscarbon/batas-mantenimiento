const contenedor=document.getElementById("contenedor");

async function cargarSolicitudes(){

const {data,error}=await supabaseClient
.from("solicitudes")
.select("*")
.eq("estado","pendiente")
.order("hora",{ascending:true});

contenedor.innerHTML="";

data.forEach(s=>{

let card=document.createElement("div");

card.className="card";

card.innerHTML=`

<p><b>Empleado:</b> ${s.empleado}</p>

<p><b>Bata:</b> ${s.bata}</p>

<p><b>Desperfecto:</b> ${s.desperfecto}</p>

<p><b>Hora:</b> ${new Date(s.hora).toLocaleString()}</p>

${s.temporal?
`
<button onclick="completar('${s.id}','arreglo')">Arreglo</button>
<button onclick="completar('${s.id}','cambio')">Cambio</button>
`
:
`<button onclick="activarTemporal('${s.id}')">Temporal</button>`
}

`;

contenedor.appendChild(card);

});

}

/* TEMPORAL */

async function activarTemporal(id){

await supabaseClient
.from("solicitudes")
.update({temporal:true})
.eq("id",id);

}

/* COMPLETAR */

async function completar(id,tipo){

await supabaseClient
.from("solicitudes")
.update({
estado:"completado",
tipo:tipo
})
.eq("id",id);

}

/* CARGA INICIAL */

cargarSolicitudes();

/* ACTUALIZACION AUTOMATICA */

supabaseClient
.channel("solicitudes")
.on(
"postgres_changes",
{event:"*",schema:"public",table:"solicitudes"},
payload=>{
cargarSolicitudes();
}
)
.subscribe();