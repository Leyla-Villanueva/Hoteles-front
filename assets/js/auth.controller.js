const authController = {};

authController.doLogin = async (data) => {

    if (!navigator.onLine) {
        console.warn("⚠ No hay conexión. Intentando login offline...");

        const storedUser = sessionStorage.getItem('username');
        const storedRole = sessionStorage.getItem('role');

        if (storedUser && storedRole) {
            console.log("✔ Usuario ya autenticado previamente. Modo offline.");
            return {
                offline: true,
                data: {
                    username: storedUser,
                    role: storedRole,
                }
            };
        }
        window.location.href = "../pages/offline.html";
        return;
    }
    try {
        const response = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        }).then(res => res.json());

        if (response.data) {
            sessionStorage.setItem('token', response.data.token);
            sessionStorage.setItem('uuid', response.data.uid);
            sessionStorage.setItem('username', response.data.username);
            sessionStorage.setItem('role', response.data.role);
        }

        return response;

    } catch (error) {
        console.error('❌ Error en login:', error);
        throw error;
    }
};

export default authController;
