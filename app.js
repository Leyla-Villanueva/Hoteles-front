

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/Hoteles-front/sw.js")
    .then(reg => console.log("SW registrado:", reg))
    .catch(err => console.log("SW error:", err));
}
