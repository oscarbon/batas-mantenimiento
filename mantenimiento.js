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


/* =========================================================
   NUEVO: EXCEL DE LAS ÚLTIMAS 3 SEMANAS
========================================================= */

async function descargarExcelTresSemanas(){

const hoy = new Date();

/*
21 días hacia atrás
*/
const fechaInicio = new Date(hoy);

fechaInicio.setDate(
fechaInicio.getDate() - 21
);

fechaInicio.setHours(
0,
0,
0,
0
);

/*
Fin del periodo:
inicio del día siguiente a hoy
*/
const fechaFin = new Date(hoy);

fechaFin.setDate(
fechaFin.getDate() + 1
);

fechaFin.setHours(
0,
0,
0,
0
);


/* CONSULTA SUPABASE */

const {data,error}=await supabaseClient
.from("solicitudes")
.select("*")
.gte(
"hora",
fechaInicio.toISOString()
)
.lt(
"hora",
fechaFin.toISOString()
)
.order(
"hora",
{
ascending:false
}
);


if(error){

console.error(
"Error al descargar solicitudes:",
error
);

alert(
"Ocurrió un error al obtener las solicitudes."
);

return;

}


/* VALIDAR DATOS */

if(!data || data.length===0){

alert(
"No existen solicitudes en las últimas 3 semanas."
);

return;

}


/* PREPARAR DATOS */

const solicitudes=data.map(s=>({

"ID":s.id,

"Empleado":s.empleado || "",

"Bata":s.bata || "",

"Desperfecto":s.desperfecto || "",

"Detalle":s.detalle || "",

"Estado":s.estado || "",

"Temporal":s.temporal ? "Sí" : "No",

"Tipo":s.tipo || "",

"Hora":s.hora
? new Date(s.hora).toLocaleString("es-MX")
: ""

}));


/* CREAR HOJA */

const worksheet=
XLSX.utils.json_to_sheet(
solicitudes
);


/* ANCHOS */

worksheet["!cols"]=[

{wch:8},
{wch:25},
{wch:18},
{wch:20},
{wch:35},
{wch:15},
{wch:12},
{wch:15},
{wch:22}

];


/* CREAR LIBRO */

const workbook=
XLSX.utils.book_new();


XLSX.utils.book_append_sheet(
workbook,
worksheet,
"Solicitudes"
);


/* NOMBRE DEL ARCHIVO */

const inicioTexto=
fechaInicio.toLocaleDateString(
"es-MX"
).replaceAll("/","-");

const hoyTexto=
hoy.toLocaleDateString(
"es-MX"
).replaceAll("/","-");


const nombreArchivo=
`Solicitudes_3_Semanas_${inicioTexto}_a_${hoyTexto}.xlsx`;


/* DESCARGAR */

XLSX.writeFile(
workbook,
nombreArchivo
);

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