const authController = {};

const API_URL = 'http://localhost:8082/api/';

authController.doLogin = async (data) => {
    try {
        const response = await fetch(`${API_URL}auth`, {
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
        console.error('Error en login:', error);
        throw error;
    }
};

export default authController;