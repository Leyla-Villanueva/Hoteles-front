// recepcion-api.js - Conexión con el backend
const API_URL = 'http://localhost:8082/api';
let rooms = [];
let users = [];
let currentFilter = 'todas';
let editingRoomId = null;
let currentUser = null;
let authToken = null;

// ==================== AUTENTICACIÓN ====================
function initializeAuth() {
    const username = sessionStorage.getItem('username');
    const role = sessionStorage.getItem('role');
    const uuid = sessionStorage.getItem('uuid');
    const token = sessionStorage.getItem('token');

    if (username && role && uuid && token) {
        currentUser = {
            id: uuid,
            username: username,
            role: role
        };
        authToken = token;

        if (currentUser.role !== 'RECEPCION' && currentUser.role !== 'RECEPCIONISTA') {
            window.alert('Acceso denegado. Esta área es solo para recepcionistas.');
            window.location.href = '../index.html';
            return;
        }

        updateNavbar();
    } else {
        window.alert('Sesión no encontrada. Redirigiendo al login...');
        window.location.href = '../index.html';
    }
}

function updateNavbar() {
    const usernameElement = document.getElementById('currentUsername');
    const roleElement = document.getElementById('currentUserRole');

    if (currentUser) {
        usernameElement.textContent = currentUser.username;
        roleElement.textContent = currentUser.role;
    }
}

function logout() {
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('uuid');
    currentUser = null;
    window.alert('Sesión cerrada.');
    window.location.href = '../index.html';
}

// ==================== HABITACIONES - API ====================
async function loadRooms() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/habitaciones`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('Error al cargar habitaciones:', data.message);
            return;
        }

        rooms = data.data || [];
        renderRooms();
        updateStats();
    } catch (error) {
        console.error('Error de conexión:', error);
        window.alert('Error al conectar con el servidor');
    }
}

async function saveRoom(event) {
    event.preventDefault();

    const roomData = {
        numero: document.getElementById('roomNumber').value.trim(), // Limpiar espacios
        estado: document.getElementById('roomStatus').value.toUpperCase()
    };

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        let response;

        if (editingRoomId) {
            // Actualizar estado de habitación existente
            response = await fetch(`${API_URL}/habitaciones/estado`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    id: editingRoomId,
                    estado: roomData.estado
                })
            });
        } else {
            // Crear nueva habitación
            response = await fetch(`${API_URL}/habitaciones`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(roomData)
            });
        }


        // Si el status es 201 (CREATED) o 200 (OK), es éxito
        if (response.status === 201 || response.status === 200) {
            // Éxito
            const alertElement = document.getElementById('alertMsg');
            alertElement.textContent = editingRoomId ? 'Habitación actualizada correctamente' : 'Habitación creada correctamente';
            alertElement.classList.remove('d-none');
            alertElement.classList.add('d-block');

            // Recargar habitaciones
            await loadRooms();

            setTimeout(() => {
                closeModal();
            }, 1500);
        } else {
            // Error
            window.alert(data.message || 'Error al guardar la habitación');
        }
    } catch (error) {
        console.error('❌ Error completo:', error);
        window.alert('Error al guardar la habitación');
    }
}

async function deleteRoom(id) {
    if (!window.confirm('¿Está seguro de eliminar esta habitación?')) {
        return;
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/habitaciones/${id}`, {
            method: 'DELETE',
            headers: headers
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        window.alert('Habitación eliminada correctamente');
        await loadRooms();
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al eliminar la habitación');
    }
}

// ==================== USUARIOS - API ====================
async function loadUsers() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/users`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('Error al cargar usuarios:', data.message);
            return;
        }

        users = data.data || [];
    } catch (error) {
        console.error('Error de conexión:', error);
    }
}

async function registerUser(event) {
    event.preventDefault();

    const userData = {
        username: document.getElementById('userName').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value
    };

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        window.alert(`✓ Usuario ${userData.username} registrado con éxito`);

        // Cerrar modal
        const userModalElement = document.getElementById('userModal');
        const userModalInstance = bootstrap.Modal.getInstance(userModalElement);
        if (userModalInstance) {
            userModalInstance.hide();
        }

        // Limpiar formulario
        document.getElementById('userForm').reset();

        // Recargar usuarios
        await loadUsers();
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al registrar el usuario');
    }
}

// ==================== UI - RENDER ====================
function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filteredRooms = rooms.filter(room => {
        const matchesSearch = room.numero.toLowerCase().includes(searchTerm);
        const matchesFilter = currentFilter === 'todas' || room.estado.toLowerCase() === currentFilter;
        return matchesSearch && matchesFilter;
    });

    grid.innerHTML = filteredRooms.map(room => {
        const estadoClass = room.estado.toLowerCase();
        const estadoBadgeClass = estadoClass === 'limpia' ? 'bg-success text-light' :
                                  estadoClass === 'sucia' ? 'bg-danger text-light' :
                                  estadoClass === 'ocupada' ? 'bg-info text-dark' :
                                  'bg-secondary text-light';

        return `
            <div class="col">
                <div class="room-card ${estadoClass} card p-3 rounded-4 shadow-sm" onclick="openEditModal('${room.id}')">
                    <div class="room-number">${room.numero}</div>
                    <span class="room-status badge fs-6 rounded-pill ${estadoBadgeClass}">
                        ${room.estado}
                    </span>
                    <div class="room-info mt-3 small text-muted">
                        <div>Habitación: ${room.numero}</div>
                    </div>
                    <div class="room-actions mt-3 d-flex gap-2">
                        <button class="btn btn-sm btn-primary flex-grow-1" onclick="event.stopPropagation(); openEditModal('${room.id}')">
                            Editar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteRoom('${room.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    document.getElementById('totalRooms').textContent = rooms.length;
    document.getElementById('cleanRooms').textContent = rooms.filter(r => r.estado === 'LIMPIA').length;
    document.getElementById('dirtyRooms').textContent = rooms.filter(r => r.estado === 'SUCIA').length;
    document.getElementById('occupiedRooms').textContent = rooms.filter(r => r.estado === 'OCUPADA').length;
}

// ==================== UI - MODALES ====================
function openAddModal() {
    editingRoomId = null;
    document.getElementById('modalTitle').textContent = 'Nueva Habitación';
    document.getElementById('roomForm').reset();
    document.getElementById('roomNumber').disabled = false;
    
    const roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
    roomModal.show();
}

function openEditModal(id) {
    editingRoomId = id;
    const room = rooms.find(r => r.id === id);

    if (!room) return;

    document.getElementById('modalTitle').textContent = 'Editar Habitación';
    document.getElementById('roomNumber').value = room.numero;
    document.getElementById('roomNumber').disabled = true; // No permitir cambiar el número
    document.getElementById('roomStatus').value = room.estado.toLowerCase();

    const roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
    roomModal.show();
}

function closeModal() {
    const modalElement = document.getElementById('roomModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    if (modalInstance) {
        modalInstance.hide();
    }

    document.getElementById('alertMsg').classList.remove('d-block');
    document.getElementById('alertMsg').classList.add('d-none');
    document.getElementById('roomNumber').disabled = false;
    editingRoomId = null;
}

function openUserModal() {
    document.getElementById('userForm').reset();
    const userModal = new bootstrap.Modal(document.getElementById('userModal'));
    userModal.show();
}

// ==================== FILTROS ====================
function setFilter(filter) {
    currentFilter = filter;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });

    renderRooms();
}

function filterRooms() {
    renderRooms();
}

// ==================== INICIALIZACIÓN ====================
async function initialize() {
    initializeAuth();
    await loadRooms();
    await loadUsers();
}

// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}