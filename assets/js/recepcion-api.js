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

// ==================== GESTIÓN DE USUARIOS ====================
let currentUserFilter = 'todos';

function openUsersListModal() {
    const modalElement = document.getElementById('usersListModal');
    if (!modalElement) {
        console.error('No se encontró el modal usersListModal');
        return;
    }
    
    try {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        renderUsersTable();
    } catch (error) {
        console.error('Error al abrir modal:', error);
    }
}

function openReportsModal() {
    const modalElement = document.getElementById('reportsModal');
    if (!modalElement) {
        console.error('No se encontró el modal reportsModal');
        return;
    }
    
    try {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        loadReportes();
    } catch (error) {
        console.error('Error al abrir modal:', error);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    <i class="bi bi-info-circle me-2"></i>
                    No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    let filteredUsers = users;
    if (currentUserFilter !== 'todos') {
        filteredUsers = users.filter(u => u.role === currentUserFilter);
    }


    tbody.innerHTML = filteredUsers.map(user => {
        const roleBadgeClass = user.role === 'CAMARERA' ? 'bg-primary' : 
                               user.role === 'RECEPCION' ? 'bg-success' : 'bg-secondary';

        return `
            <tr>
                <td>
                    <i class="bi bi-person-circle me-2"></i>
                    <strong>${user.username}</strong>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${roleBadgeClass}">${user.role}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditUserModal('${user.id}')" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.id}', '${user.username}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsers(filter, button) {
    currentUserFilter = filter;

    // Actualizar botones activos
    document.querySelectorAll('[data-user-filter]').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');

    renderUsersTable();
}

function openEditUserModal(userId) {
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        console.error('Usuario no encontrado');
        return;
    }


    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserName').value = user.username;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPassword').value = '';
    document.getElementById('editUserRole').value = user.role;

    const modalElement = document.getElementById('editUserModal');
    
    if (!modalElement) {
        console.error('No se encontró el modal editUserModal en el DOM');
        return;
    }

    try {
        const editUserModal = new bootstrap.Modal(modalElement);
        editUserModal.show();
    } catch (error) {
        console.error('Error al crear/mostrar modal:', error);
    }
}

async function updateUser(event) {
    event.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const password = document.getElementById('editUserPassword').value;

    const userData = {
        id: userId,
        username: document.getElementById('editUserName').value,
        email: document.getElementById('editUserEmail').value,
        role: document.getElementById('editUserRole').value
    };

    // Solo incluir password si se escribió algo
    if (password && password.trim() !== '') {
        userData.password = password;
    }


    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/users`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        // Mostrar mensaje de éxito
        const alertElement = document.getElementById('editUserAlertMsg');
        alertElement.textContent = 'Usuario actualizado correctamente';
        alertElement.classList.remove('d-none');
        alertElement.classList.add('d-block');


        // Recargar usuarios
        await loadUsers();
        renderUsersTable();

        setTimeout(() => {
            closeEditUserModal();
        }, 1500);
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al actualizar el usuario');
    }
}

async function deleteUser(userId, username) {

    if (!window.confirm(`¿Está seguro de eliminar al usuario "${username}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }


        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: headers
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        window.alert(`✓ Usuario "${username}" eliminado correctamente`);

        // Recargar usuarios
        await loadUsers();
        renderUsersTable();
        await loadRooms();
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al eliminar el usuario');
    }
}

function closeEditUserModal() {
    
    const modalElement = document.getElementById('editUserModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    if (modalInstance) {
        modalInstance.hide();
    }

    document.getElementById('editUserForm').reset();
    document.getElementById('editUserAlertMsg').classList.remove('d-block');
    document.getElementById('editUserAlertMsg').classList.add('d-none');
    
}

// ==================== REPORTES - API ====================
let reportes = [];

async function loadReportes() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/reportes`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('Error al cargar reportes:', data.message);
            return;
        }

        reportes = data.data || [];
        renderReportes();
    } catch (error) {
        console.error('Error de conexión:', error);
    }
}

function renderReportes() {
    const reportsModalBody = document.querySelector('#reportsModal .modal-body');
    
    if (!reportes || reportes.length === 0) {
        reportsModalBody.innerHTML = `
            <div class="alert alert-info text-center" role="alert">
                <i class="bi bi-info-circle me-2"></i>
                No hay reportes de siniestros registrados.
            </div>
        `;
        return;
    }

    reportsModalBody.innerHTML = reportes.map(reporte => {
        const fecha = new Date(reporte.fecha).toLocaleString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Construir URL de imagen correctamente
        let imagenUrl = '';
        if (reporte.imagenUrl) {
            // Si imagenUrl ya viene con /api, usar solo el servidor
            if (reporte.imagenUrl.startsWith('/api')) {
                imagenUrl = `http://localhost:8082${reporte.imagenUrl}`;
            } else {
                // Si no, agregar la ruta completa
                imagenUrl = `${API_URL}${reporte.imagenUrl}`;
            }
        }

        return `
            <div class="card shadow-sm mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title fw-bold mb-0">Habitación ${reporte.habitacionNumero || 'N/A'}</h5>
                        <span class="badge bg-warning text-dark">
                            <i class="bi bi-exclamation-triangle-fill me-1"></i>
                            Siniestro
                        </span>
                    </div>
                    <p class="card-text mb-1">
                        <strong>Descripción:</strong> ${reporte.descripcion}
                    </p>
                    <p class="card-text mb-1">
                        <strong>Reportado por:</strong> ${reporte.usuarioNombre || 'Usuario desconocido'}
                    </p>
                    <p class="card-text mb-2">
                        <strong>Fecha:</strong> ${fecha}
                    </p>
                    ${reporte.imagenUrl ? `
                        <img src="${imagenUrl}" 
                             class="img-fluid rounded border" 
                             alt="Foto del reporte"
                             style="max-height: 300px; object-fit: cover; cursor: pointer;"
                             onclick="window.open('${imagenUrl}', '_blank')"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <p class="text-danger small" style="display: none;">Error al cargar la imagen</p>
                    ` : '<p class="text-muted small">Sin imagen adjunta</p>'}
                    <div class="mt-3">
                        <button class="btn btn-sm btn-success" onclick="resolverReporte('${reporte.id}', '${reporte.habitacionId}')">
                            <i class="bi bi-check-circle me-1"></i>
                            Marcar como Resuelto
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function resolverReporte(reporteId, habitacionId) {
    if (!window.confirm('¿Desea marcar este reporte como resuelto y desbloquear la habitación?')) {
        return;
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Cambiar estado de la habitación a LIMPIA
        const response = await fetch(`${API_URL}/habitaciones/estado`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                id: habitacionId,
                estado: 'LIMPIA'
            })
        });

        if (response.status === 200 || response.status === 201) {
            // Opcionalmente, eliminar el reporte
            await fetch(`${API_URL}/reportes/${reporteId}`, {
                method: 'DELETE',
                headers: headers
            });

            window.alert('✓ Reporte resuelto y habitación desbloqueada');
            
            // Recargar datos
            await loadReportes();
            await loadRooms();
        } else {
            window.alert('Error al resolver el reporte');
        }
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al resolver el reporte');
    }
}

// ==================== ASIGNACIONES - API ====================
async function assignChambermaid(event) {
    event.preventDefault();

    const habitacionId = document.getElementById('assignRoomId').value;
    const usuarioId = document.getElementById('camareraSelect').value;



    if (!habitacionId || !usuarioId) {
        window.alert('Por favor seleccione una camarera');
        return;
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const payload = {
            habitacionId: habitacionId,
            usuarioId: usuarioId
        };
        

        const response = await fetch(`${API_URL}/asignaciones`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        // Mostrar mensaje de éxito
        const alertElement = document.getElementById('assignAlertMsg');
        alertElement.textContent = 'Camarera asignada correctamente';
        alertElement.classList.remove('d-none');
        alertElement.classList.add('d-block');


        // Recargar habitaciones
        await loadRooms();

        setTimeout(() => {
            closeAssignModal();
        }, 1500);
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al asignar la camarera');
    }
}

function openAssignModal(roomId, roomNumber) {
    
    const room = rooms.find(r => r.id === roomId);
    
    document.getElementById('assignRoomId').value = roomId;
    document.getElementById('assignRoomNumber').value = roomNumber;
    
    // Llenar el select de camareras
    fillCamarerasSelect();
    
    // Si hay una camarera asignada, seleccionarla
    if (room && room.camareraAsignada) {
        document.getElementById('camareraSelect').value = room.camareraAsignada.id;
    } else {
        document.getElementById('camareraSelect').value = '';
    }
    
    const modalElement = document.getElementById('assignModal');
    
    if (!modalElement) {
        console.error('No se encontró el modal assignModal en el DOM');
        return;
    }

    try {
        const assignModal = new bootstrap.Modal(modalElement);
        assignModal.show();
    } catch (error) {
        console.error('Error al crear/mostrar modal:', error);
    }
}

function closeAssignModal() {
    
    const modalElement = document.getElementById('assignModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    if (modalInstance) {
        modalInstance.hide();
    }

    // Limpiar el formulario
    const form = document.getElementById('assignForm');

    
    form.reset();
    
    
    document.getElementById('assignAlertMsg').classList.remove('d-block');
    document.getElementById('assignAlertMsg').classList.add('d-none');
    
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
        
        // Cargar asignaciones para cada habitación
        await loadAllAsignaciones();
        
        renderRooms();
        updateStats();
    } catch (error) {
        console.error('Error de conexión:', error);
        window.alert('Error al conectar con el servidor');
    }
}

async function loadAllAsignaciones() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/asignaciones/activas`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            console.error('Error al cargar asignaciones:', data.message);
            return;
        }

        const asignaciones = data.data || [];
        
        // Agregar info de asignación a cada habitación
        rooms.forEach(room => {
            const asignacion = asignaciones.find(a => a.habitacionId === room.id);
            if (asignacion) {
                room.asignacion = asignacion;
                room.camareraAsignada = users.find(u => u.id === asignacion.usuarioId);
            } else {
                room.asignacion = null;
                room.camareraAsignada = null;
            }
        });
        
    } catch (error) {
        console.error('Error al cargar asignaciones:', error);
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


        // Leer la respuesta
        const data = await response.json();

        // Verificar si hubo error
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
        console.error('Error completo:', error);
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
        
        // Llenar select de camareras para asignación
        fillCamarerasSelect();
    } catch (error) {
        console.error('Error de conexión:', error);
    }
}

function fillCamarerasSelect() {
    const camareraSelect = document.getElementById('camareraSelect');
    if (!camareraSelect) {
        console.error('No se encontró el select camareraSelect');
        return;
    }

    camareraSelect.innerHTML = '<option value="">Seleccione una camarera...</option>';
    
    const camareras = users.filter(u => u.role === 'CAMARERA');
    
    camareras.forEach(camarera => {
        const option = document.createElement('option');
        option.value = camarera.id;
        option.textContent = camarera.username;
        camareraSelect.appendChild(option);
    });
    
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

        // Mostrar camarera asignada si existe
        const camareraInfo = room.camareraAsignada 
            ? `<div class="mt-2">
                 <span class="badge bg-success">
                   <i class="bi bi-person-check me-1"></i>${room.camareraAsignada.username}
                 </span>
               </div>`
            : '';

        return `
            <div class="col">
                <div class="room-card ${estadoClass} card p-3 rounded-4 shadow-sm" onclick="openEditModal('${room.id}')">
                    <div class="room-number">${room.numero}</div>
                    <span class="room-status badge fs-6 rounded-pill ${estadoBadgeClass}">
                        ${room.estado}
                    </span>
                    ${camareraInfo}
                    <div class="room-info mt-3 small text-muted">
                        <div>Habitación: ${room.numero}</div>
                    </div>
                    <div class="room-actions mt-3 d-flex gap-2">
                        <button class="btn btn-sm btn-primary flex-grow-1" onclick="event.stopPropagation(); openEditModal('${room.id}')">
                            Editar
                        </button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); openQRModal('${room.id}', '${room.numero}')" title="Ver código QR">
                            <i class="bi bi-qr-code"></i>
                        </button>
                        <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); openAssignModal('${room.id}', '${room.numero}')" title="Asignar camarera">
                            <i class="bi bi-person-plus"></i>
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
    
    const modalElement = document.getElementById('roomModal');
    if (!modalElement) {
        console.error('No se encontró el modal roomModal');
        return;
    }
    
    try {
        const roomModal = new bootstrap.Modal(modalElement);
        roomModal.show();
    } catch (error) {
        console.error('Error al abrir modal:', error);
    }
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
    
    const modalElement = document.getElementById('userModal');
    if (!modalElement) {
        console.error('No se encontró el modal userModal');
        return;
    }
    
    try {
        const userModal = new bootstrap.Modal(modalElement);
        userModal.show();
    } catch (error) {
        console.error('Error al abrir modal:', error);
    }
}

// ==================== QR CODE ====================
let currentQRData = null;

function openQRModal(roomId, roomNumber) {
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
        window.alert('Habitación no encontrada');
        return;
    }

    // Guardar datos para descarga
    currentQRData = {
        roomId: roomId,
        roomNumber: roomNumber,
        qrBase64: room.qr
    };

    // Mostrar número de habitación
    document.getElementById('qrRoomNumber').textContent = roomNumber;
    
    // Mostrar imagen QR
    const qrImage = document.getElementById('qrImage');
    
    if (room.qr) {
        // El QR viene como byte array, convertirlo a base64
        qrImage.src = `data:image/png;base64,${room.qr}`;
        qrImage.style.display = 'block';
    } else {
        qrImage.style.display = 'none';
        window.alert('Esta habitación no tiene código QR generado');
        return;
    }

    // Abrir modal
    const modalElement = document.getElementById('qrModal');
    if (!modalElement) {
        console.error('No se encontró el modal qrModal');
        return;
    }
    
    try {
        const qrModal = new bootstrap.Modal(modalElement);
        qrModal.show();
    } catch (error) {
        console.error('Error al abrir modal QR:', error);
    }
}

function downloadQR() {
    if (!currentQRData) {
        window.alert('No hay código QR para descargar');
        return;
    }

    try {
        // Crear un enlace temporal para descargar
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${currentQRData.qrBase64}`;
        link.download = `QR_Habitacion_${currentQRData.roomNumber}.png`;
        
        // Simular click para descargar
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('QR descargado exitosamente');
    } catch (error) {
        console.error('Error al descargar QR:', error);
        window.alert('Error al descargar el código QR');
    }
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
    
    await loadUsers();
    
    await loadRooms();
    
    await loadReportes();
    
}

// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Event listeners para modales - DESPUÉS de que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal && bootstrap.Modal.VERSION) {
    }
});