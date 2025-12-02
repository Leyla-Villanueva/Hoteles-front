document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();

  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!user || !pass || !role) {
    alert("Completa todos los campos");
    return;
  }

  const routes = {
    reception: "./pages/reception.html",
    maid: "./pages/maid.html"
  };

  window.location.href = routes[role];
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(reg => console.log("SW registrado:", reg))
    .catch(err => console.log("SW error:", err));
}