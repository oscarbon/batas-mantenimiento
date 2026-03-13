async function cargarInventario(){

const {data}=await supabaseClient
.from("inventario")
.select("*")
.single();

document.getElementById("punos").innerText=data.punos;
document.getElementById("bordado").innerText=data.bordado;

}