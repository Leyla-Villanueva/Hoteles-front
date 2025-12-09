// maid-api.js - Conexión con el backend
const API_URL = 'http://localhost:8082/api';
let rooms = [];
let asignaciones = [];
let currentFilter = 'asignadas';
let selectedRoom = null;
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

        if (currentUser.role !== 'CAMARERA') {
            window.alert('Acceso denegado. Esta área es solo para camareras.');
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
            showNotification('Error al cargar habitaciones', 'danger');
            return;
        }

        rooms = data.data || [];
        await loadAsignaciones();
        renderRooms();
        updateStats();
    } catch (error) {
        console.error('Error de conexión:', error);
        showNotification('Error al conectar con el servidor', 'danger');
    }
}

async function loadAsignaciones() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/asignaciones/usuario/${currentUser.id}`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('Error al cargar asignaciones:', data.message);
            return;
        }

        asignaciones = data.data || [];

        // Marcar habitaciones asignadas
        rooms.forEach(room => {
            room.assigned = asignaciones.some(a => a.habitacionId === room.id);
        });
    } catch (error) {
        console.error('Error al cargar asignaciones:', error);
    }
}

async function markClean() {
    if (!selectedRoom) return;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/habitaciones/marcar-limpia/${selectedRoom.id}`, {
            method: 'PUT',
            headers: headers
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        showNotification(`✓ Habitación ${selectedRoom.numero} marcada como limpia`, 'success');
        closeModal();
        await loadRooms();
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al marcar la habitación como limpia');
    }
}

// ==================== REPORTES - API ====================
async function submitSiniestro() {
    const roomId = document.getElementById('siniestroRoom').value;
    const desc = document.getElementById('siniestroDesc').value;
    const file = document.getElementById('siniestroFile').files[0];

    if (!roomId || !desc || !file) {
        window.alert('Por favor complete todos los campos y adjunte una fotografía.');
        return;
    }

    try {
        const base64Image = await fileToBase64(file);

        const reporteData = {
            descripcion: desc,
            imagenBase64: base64Image,
            usuarioId: currentUser.id,
            habitacionId: roomId
        };

        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/reportes`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(reporteData)
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        // Limpiar formulario
        document.getElementById('siniestroRoom').value = '';
        document.getElementById('siniestroDesc').value = '';
        document.getElementById('siniestroFile').value = '';
        document.getElementById('imagePreview').classList.add('hidden');

        showNotification('⚠ Siniestro reportado. Habitación bloqueada.', 'danger');

        await loadRooms();

        // Volver a la pestaña de habitaciones
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(t => t.classList.remove('active'));
        tabs[0].classList.add('active');
        document.getElementById('siniestros').classList.add('hidden');
        document.getElementById('habitaciones').classList.remove('hidden');
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al reportar el siniestro');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// ==================== UI - RENDER ====================
function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    const siniestroRoomSelect = document.getElementById('siniestroRoom');

    grid.innerHTML = '';
    siniestroRoomSelect.innerHTML = '<option value="">Seleccione una habitación</option>';

    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filteredRooms = rooms.filter(room => {
        const matchesSearch = room.numero.toLowerCase().includes(searchTerm);
        let matchesFilter = true;

        if (currentFilter === 'asignadas') {
            matchesFilter = room.assigned === true;
        } else if (currentFilter !== 'todas') {
            matchesFilter = room.estado.toLowerCase() === currentFilter;
        }

        return matchesSearch && matchesFilter;
    });

    if (filteredRooms.length === 0) {
        grid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info text-center mt-3" role="alert">
                    <i class="bi bi-info-circle me-2"></i>
                    No hay habitaciones que coincidan con el filtro '${currentFilter}' o la búsqueda.
                </div>
            </div>`;
    } else {
        filteredRooms.forEach(room => {
            const card = createRoomCard(room);
            const col = document.createElement('div');
            col.className = 'col';
            col.appendChild(card);
            grid.appendChild(col);
        });
    }

    // Llenar select de siniestros
    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = `Habitación ${room.numero} (${room.estado})`;
        siniestroRoomSelect.appendChild(option);
    });

    updateStats();
}

function createRoomCard(room) {
    const card = document.createElement('div');
    const estadoLower = room.estado.toLowerCase();

    const statusText = {
        'limpia': 'LIMPIA',
        'sucia': 'SUCIA',
        'ocupada': 'OCUPADA',
        'bloqueada': 'BLOQUEADA'
    };

    const siniestroHTML = estadoLower === 'bloqueada' ?
        '<span class="alert-siniestro d-block"><i class="bi bi-exclamation-triangle-fill me-1"></i> Con siniestro</span>' : '';

    const assignedBadge = room.assigned ?
        '<span class="assigned-badge d-block"><i class="bi bi-person-check-fill me-1"></i> Asignada a mí</span>' : '';

    card.className = `room-card ${estadoLower} card p-3 rounded-4 shadow-sm`;
    card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="width: 100%;">
            <div class="room-number flex-grow-1" style="flex-basis: 20%; font-size: 1.4rem; font-weight: 700;">
                ${room.numero}
            </div>
            <div class="flex-grow-1" style="flex-basis: 80%; text-align: right;">
                <span class="room-status badge rounded-pill status-${estadoLower}">
                    ${statusText[room.estado.toUpperCase()] || room.estado}
                </span>
            </div>
        </div>
        ${assignedBadge}
        ${siniestroHTML}
        <div class="room-info mt-3 small text-muted">
            <div class="d-flex align-items-center mb-1" style="width: 100%;">
                <div class="flex-grow-1" style="flex-basis: 50%;">
                    <i class="bi bi-tag me-1"></i>Habitación
                </div>
                <div class="flex-grow-1 text-end" style="flex-basis: 50%;">
                    <i class="bi bi-building me-1"></i>${room.numero}
                </div>
            </div>
        </div>
        <div class="room-actions mt-3">
            <button class="btn btn-primary w-100" onclick='openRoomModal(${JSON.stringify(room).replace(/'/g, "\\'")})'> 
                Editar
            </button>
        </div>
    `;

    return card;
}

function updateStats() {
    const total = rooms.length;
    const limpias = rooms.filter(r => r.estado === 'LIMPIA').length;
    const sucias = rooms.filter(r => r.estado === 'SUCIA').length;
    const ocupadas = rooms.filter(r => r.estado === 'OCUPADA').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statLimpias').textContent = limpias;
    document.getElementById('statSucias').textContent = sucias;
    document.getElementById('statOcupadas').textContent = ocupadas;
}

// ==================== UI - TABS Y FILTROS ====================
function showTab(tabName, element) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    element.classList.add('active');
    document.getElementById(tabName).classList.remove('hidden');
}

function filterRooms(filter, element) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    renderRooms();
}

function searchRooms() {
    renderRooms();
}

// ==================== UI - MODALES ====================
function openRoomModal(room) {
    if (room.estado.toLowerCase() === 'bloqueada') {
        window.alert('Esta habitación está bloqueada por siniestro/avería. Debe ser revisada por mantenimiento.');
        return;
    }

    selectedRoom = room;
    document.getElementById('modalRoomNumber').textContent = room.numero;

    const statusTexts = {
        'LIMPIA': 'Limpia',
        'SUCIA': 'Pendiente de limpieza',
        'OCUPADA': 'Ocupada',
    };

    document.getElementById('modalRoomStatus').textContent = statusTexts[room.estado] || room.estado;

    const roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
    roomModal.show();
}

function closeModal() {
    const modalElement = document.getElementById('roomModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    if (modalInstance) {
        modalInstance.hide();
    }

    selectedRoom = null;
}

function previewImage(input) {
    const preview = document.getElementById('imagePreview');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.classList.add('hidden');
    }
}

// ==================== NOTIFICACIONES ====================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');

    const bgColors = {
        'success': 'var(--success-color)',
        'danger': 'var(--danger-color)',
        'warning': 'var(--warning-color)',
        'info': 'var(--secondary-color)'
    };

    notification.style.cssText = `
        position: fixed;
        top: 75px;
        right: 20px;
        background: ${bgColors[type] || bgColors.success};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 2000;
        font-weight: 600;
        transition: opacity 0.3s;
        min-width: 250px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== INICIALIZACIÓN ====================
async function initialize() {
    initializeAuth();
    await loadRooms();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}