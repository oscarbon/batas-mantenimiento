const contenedor = document.getElementById("contenedor");
const contador = document.getElementById("contador");

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

${s.desperfecto === "Tela rasgada" && s.detalle ? 
`<p><b>Detalle:</b> ${s.detalle}</p>` : ""}

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

window.activarTemporal = async function(id){

const {error}=await supabaseClient
.from("solicitudes")
.update({temporal:true})
.eq("id",Number(id));

if(error) console.error(error);

cargarSolicitudes();

}

window.completar = async function(id,tipo){

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

/* REALTIME */

supabaseClient
.channel("realtime-solicitudes")
.on(
"postgres_changes",
{
event: "INSERT",
schema: "public",
table: "solicitudes"
},
payload => {

const s = payload.new;

if(s.estado !== "pendiente") return;

if(document.getElementById("sol_" + s.id)) return;

/* crear tarjeta nueva */

let card = document.createElement("div");
card.className = "card";
card.id = "sol_" + s.id;

card.innerHTML = `

<p><b>Empleado:</b> ${s.empleado}</p>
<p><b>Bata:</b> ${s.bata}</p>
<p><b>Desperfecto:</b> ${s.desperfecto}</p>

${s.desperfecto === "Tela rasgada" && s.detalle ? 
`<p><b>Detalle:</b> ${s.detalle}</p>` : ""}

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

contenedor.prepend(card);

/* actualizar contador */

let total = contenedor.children.length;
contador.innerText = "Solicitudes activas: " + total;

}
)
.subscribe();