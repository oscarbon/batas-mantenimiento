const contenedor = document.getElementById("contenedor");


/* =========================================================
   CARGAR SOLICITUDES PENDIENTES
========================================================= */

async function cargarSolicitudes(){

    const { data, error } = await supabaseClient
        .from("solicitudes")
        .select("*")
        .eq("estado", "pendiente")
        .order("hora", { ascending: true });

    if(error){

        console.error("Error cargando solicitudes:", error);

        return;
    }

    contenedor.innerHTML = "";

    if(!data || data.length === 0){

        contenedor.innerHTML = `
            <p>No hay solicitudes pendientes.</p>
        `;

        return;
    }

    data.forEach(s => {

        let card = document.createElement("div");

        card.className = "card";

        card.innerHTML = `

        <p><b>Empleado:</b> ${s.empleado}</p>

        <p><b>Bata:</b> ${s.bata}</p>

        <p><b>Desperfecto:</b> ${s.desperfecto}</p>

        <p><b>Hora:</b> ${new Date(s.hora).toLocaleString()}</p>

        ${
            s.temporal
            ?
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


/* =========================================================
   TEMPORAL
========================================================= */

async function activarTemporal(id){

    const { error } = await supabaseClient
        .from("solicitudes")
        .update({
            temporal: true
        })
        .eq("id", id);

    if(error){

        console.error("Error activando temporal:", error);

        return;
    }

    cargarSolicitudes();
}


/* =========================================================
   COMPLETAR
========================================================= */

async function completar(id, tipo){

    const { error } = await supabaseClient
        .from("solicitudes")
        .update({
            estado: "completado",
            tipo: tipo
        })
        .eq("id", id);

    if(error){

        console.error("Error completando solicitud:", error);

        return;
    }

    cargarSolicitudes();
}


/* =========================================================
   CONVERTIR FECHA LOCAL A ISO PARA SUPABASE
========================================================= */

function fechaLocalISO(fecha){

    const year = fecha.getFullYear();

    const month = String(
        fecha.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        fecha.getDate()
    ).padStart(2, "0");

    const hours = String(
        fecha.getHours()
    ).padStart(2, "0");

    const minutes = String(
        fecha.getMinutes()
    ).padStart(2, "0");

    const seconds = String(
        fecha.getSeconds()
    ).padStart(2, "0");

    const offset = -fecha.getTimezoneOffset();

    const sign = offset >= 0 ? "+" : "-";

    const absoluteOffset = Math.abs(offset);

    const offsetHours = String(
        Math.floor(absoluteOffset / 60)
    ).padStart(2, "0");

    const offsetMinutes = String(
        absoluteOffset % 60
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}


/* =========================================================
   FORMATO YYYY-MM-DD
========================================================= */

function formatoFecha(fecha){

    const year = fecha.getFullYear();

    const month = String(
        fecha.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        fecha.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =========================================================
   EXCEL DE LAS ÚLTIMAS 3 SEMANAS
========================================================= */

async function descargarExcelTresSemanas(){

    try{

        /* ---------------------------------------------
           FECHA ACTUAL
        --------------------------------------------- */

        const hoy = new Date();

        /*
        21 días hacia atrás
        */

        const fechaInicio = new Date(hoy);

        fechaInicio.setDate(
            fechaInicio.getDate() - 21
        );

        /*
        Inicio del día de hace 21 días
        */

        fechaInicio.setHours(
            0,
            0,
            0,
            0
        );

        /*
        Inicio del día siguiente a hoy
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


        /* ---------------------------------------------
           CONSULTA SUPABASE
        --------------------------------------------- */

        const { data, error } = await supabaseClient
            .from("solicitudes")
            .select("*")
            .gte(
                "hora",
                fechaLocalISO(fechaInicio)
            )
            .lt(
                "hora",
                fechaLocalISO(fechaFin)
            )
            .order(
                "hora",
                {
                    ascending: false
                }
            );


        if(error){

            console.error(
                "Error descargando solicitudes:",
                error
            );

            alert(
                "Ocurrió un error al obtener las solicitudes."
            );

            return;
        }


        /* ---------------------------------------------
           VALIDAR SI HAY DATOS
        --------------------------------------------- */

        if(!data || data.length === 0){

            alert(
                "No existen solicitudes en las últimas 3 semanas."
            );

            return;
        }


        /* ---------------------------------------------
           PREPARAR DATOS PARA EXCEL
        --------------------------------------------- */

        const solicitudesExcel = data.map(s => {

            return {

                "ID":
                    s.id,

                "Empleado":
                    s.empleado || "",

                "Bata":
                    s.bata || "",

                "Desperfecto":
                    s.desperfecto || "",

                "Detalle":
                    s.detalle || "",

                "Estado":
                    s.estado || "",

                "Temporal":
                    s.temporal
                    ? "Sí"
                    : "No",

                "Tipo":
                    s.tipo || "",

                "Hora":
                    s.hora
                    ? new Date(
                        s.hora
                      ).toLocaleString(
                        "es-MX"
                      )
                    : ""

            };

        });


        /* ---------------------------------------------
           CREAR EXCEL
        --------------------------------------------- */

        const worksheet =
            XLSX.utils.json_to_sheet(
                solicitudesExcel
            );


        /* ---------------------------------------------
           AJUSTAR ANCHO DE COLUMNAS
        --------------------------------------------- */

        worksheet["!cols"] = [

            { wch: 8 },   // ID

            { wch: 25 },  // Empleado

            { wch: 18 },  // Bata

            { wch: 20 },  // Desperfecto

            { wch: 35 },  // Detalle

            { wch: 15 },  // Estado

            { wch: 12 },  // Temporal

            { wch: 15 },  // Tipo

            { wch: 22 }   // Hora

        ];


        /* ---------------------------------------------
           CREAR LIBRO
        --------------------------------------------- */

        const workbook =
            XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Solicitudes"
        );


        /* ---------------------------------------------
           NOMBRE DEL ARCHIVO
        --------------------------------------------- */

        const fechaInicioTexto =
            formatoFecha(fechaInicio);

        const fechaFinTexto =
            formatoFecha(hoy);


        const nombreArchivo =
            `Solicitudes_3_Semanas_${fechaInicioTexto}_a_${fechaFinTexto}.xlsx`;


        /* ---------------------------------------------
           DESCARGAR
        --------------------------------------------- */

        XLSX.writeFile(
            workbook,
            nombreArchivo
        );


        console.log(
            `Excel generado: ${nombreArchivo}`
        );

    }
    catch(error){

        console.error(
            "Error inesperado:",
            error
        );

        alert(
            "Ocurrió un error al generar el Excel."
        );

    }

}


/* =========================================================
   HACER LA FUNCIÓN GLOBAL
========================================================= */

window.descargarExcelTresSemanas =
    descargarExcelTresSemanas;


/* =========================================================
   CARGA INICIAL
========================================================= */

cargarSolicitudes();


/* =========================================================
   ACTUALIZACIÓN AUTOMÁTICA
========================================================= */

supabaseClient
    .channel("solicitudes")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "solicitudes"
        },
        payload => {

            cargarSolicitudes();

        }
    )
    .subscribe();