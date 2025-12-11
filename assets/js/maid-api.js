let rooms = [];
let asignaciones = [];
let currentFilter = 'asignadas';
let selectedRoom = null;
let currentUser = null;
let authToken = null;
let html5QrcodeScanner = null;
let scannedRoomFromQR = null;

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

// ==================== ESCÁNER QR ====================
function openQRScanner() {
    const modalElement = document.getElementById('qrScannerModal');
    const qrModal = new bootstrap.Modal(modalElement);
    qrModal.show();

    // Iniciar escáner después de que el modal se muestre
    setTimeout(() => {
        startQRScanner();
    }, 500);
}

function startQRScanner() {
    const qrReaderElement = document.getElementById('qr-reader');
    
    if (!qrReaderElement) {
        console.error('Elemento qr-reader no encontrado');
        return;
    }

    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error('Error al iniciar escáner:', err);
        showNotification('Error al acceder a la cámara', 'danger');
    });
}

async function onScanSuccess(decodedText, decodedResult) {
    
    // Detener el escáner
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
        }).catch(err => {
            console.error('Error al detener escáner:', err);
        });
    }

    // Cerrar modal de escáner
    const scannerModalElement = document.getElementById('qrScannerModal');
    const scannerModalInstance = bootstrap.Modal.getInstance(scannerModalElement);
    if (scannerModalInstance) {
        scannerModalInstance.hide();
    }

    // Buscar habitación por ID
    await loadRoomByQR(decodedText);
}

function onScanFailure(error) {
    // No hacer nada en caso de fallo (es normal mientras se escanea)
    // console.warn('Error de escaneo:', error);
}

function closeQRScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
        }).catch(err => {
            console.error('Error al cerrar escáner:', err);
        });
    }
}

async function loadRoomByQR(roomId) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/habitaciones/${roomId}`, {
            method: 'GET',
            headers: headers
        });
        
        const data = await response.json();

        if (data.error) {
            showNotification('Habitación no encontrada', 'danger');
            return;
        }

        const room = data.data;
        scannedRoomFromQR = room;
        
        // Abrir modal con la información de la habitación
        openQRRoomModal(room);
        
    } catch (error) {
        console.error('Error al cargar habitación:', error);
        showNotification('Error al cargar la habitación', 'danger');
    }
}

function openQRRoomModal(room) {
    if (room.estado.toLowerCase() === 'bloqueada') {
        window.alert('Esta habitación está bloqueada por siniestro/avería. Debe ser revisada por mantenimiento.');
        scannedRoomFromQR = null;
        return;
    }

    document.getElementById('qrModalRoomNumber').textContent = room.numero;

    const statusTexts = {
        'LIMPIA': 'Limpia',
        'SUCIA': 'Pendiente de limpieza',
        'OCUPADA': 'Ocupada',
    };

    document.getElementById('qrModalRoomStatus').textContent = statusTexts[room.estado] || room.estado;

    // Deshabilitar botón de "Marcar como Limpia" si ya está limpia
    const markCleanBtn = document.querySelector('#roomQRModal .btn-success');
    if (room.estado.toUpperCase() === 'LIMPIA') {
        markCleanBtn.disabled = true;
        markCleanBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Ya está Limpia';
        markCleanBtn.classList.add('opacity-50');
    } else {
        markCleanBtn.disabled = false;
        markCleanBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Marcar como Limpia';
        markCleanBtn.classList.remove('opacity-50');
    }

    const roomQRModal = new bootstrap.Modal(document.getElementById('roomQRModal'));
    roomQRModal.show();
}

function closeQRRoomModal() {
    const modalElement = document.getElementById('roomQRModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    if (modalInstance) {
        modalInstance.hide();
    }

    scannedRoomFromQR = null;
}

async function markCleanFromQR() {
    if (!scannedRoomFromQR) return;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}/habitaciones/marcar-limpia/${scannedRoomFromQR.id}`, {
            method: 'PUT',
            headers: headers
        });

        const data = await response.json();

        if (data.error) {
            window.alert(data.message);
            return;
        }

        showNotification(`✓ Habitación ${scannedRoomFromQR.numero} marcada como limpia`, 'success');
        closeQRRoomModal();
        await loadRooms();
    } catch (error) {
        console.error('Error:', error);
        window.alert('Error al marcar la habitación como limpia');
    }
}

function reportSiniestroFromQR() {
    if (!scannedRoomFromQR) {
        console.error('No hay habitación escaneada');
        return;
    }


    // Guardar el ID de la habitación antes de cerrar
    const roomIdToReport = scannedRoomFromQR.id;
    const roomNumberToReport = scannedRoomFromQR.numero;

    // Cerrar modal QR
    closeQRRoomModal();

    // Cambiar a la pestaña de siniestros
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[1].classList.add('active'); // Tab de siniestros
    
    document.getElementById('habitaciones').classList.add('hidden');
    document.getElementById('siniestros').classList.remove('hidden');

    // Preseleccionar la habitación en el select
    setTimeout(() => {
        const siniestroRoomSelect = document.getElementById('siniestroRoom');

        
        // Intentar seleccionar por ID
        siniestroRoomSelect.value = roomIdToReport;
        
        
        if (siniestroRoomSelect.value === roomIdToReport) {
            showNotification(`Habitación ${roomNumberToReport} seleccionada para reporte`, 'info');
        } else {
            console.error('❌ No se pudo seleccionar la habitación');
            showNotification(`Seleccione manualmente la habitación ${roomNumberToReport}`, 'warning');
        }
        
        // Hacer scroll al select para que el usuario lo vea
        siniestroRoomSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight del select
        siniestroRoomSelect.classList.add('border-primary');
        siniestroRoomSelect.style.borderWidth = '3px';
        setTimeout(() => {
            siniestroRoomSelect.classList.remove('border-primary');
            siniestroRoomSelect.style.borderWidth = '';
        }, 2000);
        
    }, 500);
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

    // Deshabilitar botón de "Marcar como Limpia" si ya está limpia
    const markCleanBtn = document.querySelector('#roomModal .btn-success');
    if (room.estado.toUpperCase() === 'LIMPIA') {
        markCleanBtn.disabled = true;
        markCleanBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Ya está Limpia';
        markCleanBtn.classList.add('opacity-50');
    } else {
        markCleanBtn.disabled = false;
        markCleanBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Marcar como Limpia';
        markCleanBtn.classList.remove('opacity-50');
    }

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
        'warning': '#f59e0b',
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