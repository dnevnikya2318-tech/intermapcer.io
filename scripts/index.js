const mainTitle = document.getElementById('mainTitle');
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const viewArea = document.getElementById('viewArea');
const fullPreview = document.getElementById('fullPreview');
const resetBtn = document.getElementById('resetBtn');
const imageWrapper = document.getElementById('imageWrapper');
const markersLayer = document.getElementById('markersLayer');
const popup = document.getElementById('labelPopup');
const addLabelBtn = document.getElementById('addLabelBtn');
const deletePopup = document.getElementById('deletePopup');
const deleteLabelBtn = document.getElementById('deleteLabelBtn');

// Label input counter logic
const titleInput = document.getElementById('titleInput');
const titleInputCount = document.getElementById('titleInputCount');
const titleInputMaxChar = titleInput.maxLength;

const descriptionInput = document.getElementById('descriptionInput');
const descriptionInputCount = document.getElementById('descriptionInputCount');
const descriptionInputMaxChar = descriptionInput.maxLength;
const token = localStorage.getItem('authToken');
const putLabelBtn = document.getElementById('putLabelBtn');
const updateLabelBtn = document.getElementById('updateLabelBtn');

const toggleAccess = document.getElementById('toggleAccess');
const copyLinkBtn = document.getElementById('copyLinkBtn');


let currMapId = null;
let currMarkImage = null;

let currPoint = null;

let popupPoint = null;
let selectedMarkerId = null;

let configResponse = null;
let config = null;
let apiBaseUrl = null;
let s3BaseUrl = null;
let frontBaseUrl = null;

class Point {
    constructor(id, mapId, title, description, x, y, size, markType, imagePath, imageName) {
        this.Id = id;
        this.MapId = mapId;
        this.Title = title;
        this.Description = description;
        this.X = x;
        this.Y = y;
        this.Size = size;
        this.MarkType = markType;
        this.ImagePath = imagePath;
        this.ImageName = imageName;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    configResponse = await fetch('./config.json');
    config = await configResponse.json();
    apiBaseUrl = config.API_BASE_URL;
    s3BaseUrl = config.S3_BASE_URL;
    frontBaseUrl = config.FRONT_BASE_URL;

    const userInfoElement = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Authentification 
    if (!token)
    {
        window.location.href = 'login/';
        return;
    }

    // Getting data from token
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);

        const idKey = Object.keys(payload).find(key => key.includes('nameid'));
        const userId = payload[idKey] || payload.sub || payload.id;

        const nameKey = Object.keys(payload).find(key => key.endsWith('/name'));
        const username = payload[nameKey] || payload.unique_name || payload.name || "User";

        userInfoElement.innerText = `You are: ${username}`;
    } catch (e) {
        console.error('Error occured while reading token:', e);
        localStorage.removeItem('authToken');
        window.location.href = 'login/';
        return;
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login/';
    })

})

titleInput.addEventListener('input', () => {
    const remaining = titleInputMaxChar - titleInput.value.length;
    titleInputCount.textContent = remaining;
});

descriptionInput.addEventListener('input', () => {
    const remaining = descriptionInputMaxChar - descriptionInput.value.length;
    descriptionInputCount.textContent = remaining;
});

function hidePopups() {
    const labelPopups = document.querySelectorAll('.marker-label');
    popup.classList.remove('show');
    deletePopup.classList.remove('show');
    labelPopups.forEach(el => {
        el.style.display = 'none';
    });
    popupPoint = null;
    selectedMarkerId = null;
    currPoint = null;
}

function positionPopup(popupElement, x, y) {
    const rect = imageWrapper.getBoundingClientRect();
    const popupWidth = popupElement.offsetWidth;
    const popupHeight = popupElement.offsetHeight;

    const maxLeft = rect.width - popupWidth - 6;
    const maxTop = rect.height - popupHeight - 6;

    const left = Math.min(Math.max(x + 6, 4), maxLeft);
    const top = Math.min(Math.max(y + 6, 4), maxTop);

    popupElement.style.left = `${left}px`;
    popupElement.style.top = `${top}px`;
}

// При вызове функция создаёт на карте маркеры и соответствующие им описания
async function createMarker(point) {
    const id = point.Id;

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.id = id;
    marker.style.left = `${point.X}px`;
    marker.style.top = `${point.Y}px`;
    marker.textContent = point.MarkType;
    marker.style.color = markerColorSelection(point.MarkType);
    marker.style.width = `${9 + point.Size}px`;
    marker.style.height = `${9 + point.Size}px`;
    marker.style.fontSize = `${point.Size}px`;

    if (point.MarkType == "⌖"){
        marker.style.fontWeight = 500;
    }

    const label = document.createElement('div');
    const pointTitle = document.createElement('h1');
    const pointDescription = document.createElement('p');
    const hr = document.createElement('hr');
    
    
    pointTitle.className = 'point-title';
    pointDescription.className = 'point-description';
    pointTitle.textContent = `${point.Title}`;
    pointDescription.textContent = `${point.Description}`;
    label.appendChild(pointTitle);
    label.appendChild(hr);
    label.appendChild(pointDescription);
    if (point.ImageName != null)
    {
        const labelImg = document.createElement('img');
        await loadImage(s3BaseUrl + point.ImageName, labelImg);
        label.appendChild(labelImg);
    }

    
    label.className = 'marker-label';
    label.dataset.id = id;
    label.style.left = `${point.X}px`;
    label.style.top = `${point.Y + 10}px`;
    label.style.display = 'none';

    // TO UPDATE
    // Добавить кнопку UPDATE 
    const showDeleteHandler = (e) => {
        hidePopups();
        e.preventDefault();
        e.stopPropagation();
        selectedMarkerId = id;

        const rect = imageWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        deletePopup.classList.add('show');
        positionPopup(deletePopup, x, y);

        popup.classList.remove('show');
    };

    marker.addEventListener('contextmenu', showDeleteHandler);
    label.addEventListener('contextmenu', showDeleteHandler);
    // Показывает данные точки при нажатии на неё
    marker.addEventListener('click', (e) => {
        hidePopups();
        e.stopPropagation();
        const rect = imageWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        label.style.display = 'flex';

        positionPopup(label, x, y);
        
    });

    markersLayer.appendChild(marker);
    markersLayer.appendChild(label);
}

dropArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) {
        await uploadMap(fileInput.files[0]);
    }
});

dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('drop-zone--over');
});

['dragleave', 'dragend'].forEach(type => {
    dropArea.addEventListener(type, () => {
        dropArea.classList.remove('drop-zone--over')
    });
});

dropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropArea.classList.remove('drop-zone--over');

    if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];

        await uploadMap(file);
    }
});

async function showMap(filePath) {
    await loadImage(filePath, fullPreview);

    mainTitle.style.display = 'none';
    dropArea.style.display = 'none';
    viewArea.style.display = 'block';
    markersLayer.innerHTML = '';

    try {
        const response = await fetch(`${apiBaseUrl}/landmarks/map/${currMapId}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': true
            }
        });
        const data = await response.json();
        data.forEach(async element => {
            const point = new Point(
                element.id,
                element.mapId,
                element.title,
                element.description,
                element.x,
                element.y,
                element.size,
                element.markType,
                element.imagePath,
                element.imageName
            );
            await createMarker(point);
    })} catch(error) {
        console.log(error);
    }
}

//TOUPDATE
// Отображает название карты и уровень доступа, а также реагирует на их изменения.
async function showTitle() {
    const response = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json', 
            'bypass-tunnel-reminder': true 
        }
    });
    const mapTitleInput = document.getElementById('mapTitleInput');
    const mapTitleForm = document.getElementById('mapTitleForm');
    map = await response.json();

    mapTitleInput.style.visibility = 'visible';
    mapTitleInput.value = map.title;
    mapTitleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        mapTitleInput.blur();
        
        try {
            const oldResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json', 
                    'bypass-tunnel-reminder': true
                 }
            });
            oldMap = await oldResponse.json();
            const newResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': true
                 },
                body: JSON.stringify({ ownerId: oldMap.ownerId, title: mapTitleInput.value, isPublic: oldMap.isPublic, imagePath: oldMap.imagePath, imageName: oldMap.imageName })
            })
        } catch (error) {
            console.error("Error occured while updating maps title: ", error);
            return;
        }});

    
    
    toggleAccess.style.display = 'flex';
    if(map.isPublic) {
        toggleAccess.classList.add('is-public');
        copyLinkBtn.classList.add('show');
    } else {
        toggleAccess.classList.remove('is-public');
        copyLinkBtn.classList.remove('show');
    }

    // Логика переключения
    toggleAccess.addEventListener('click', async () => {
        // Переключаем класс активности у контейнера
        const isPublic = toggleAccess.classList.toggle('is-public');
        
        // Показываем или скрываем кнопку копирования
        if (isPublic) {
            copyLinkBtn.classList.add('show');
            try {
                const oldResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'bypass-tunnel-reminder': true,
                     }
                });
                oldMap = await oldResponse.json();
                const newResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'bypass-tunnel-reminder': true
                    },
                    body: JSON.stringify({ ownerId: oldMap.ownerId, title: oldMap.title, isPublic: true, imagePath: oldMap.imagePath, imageName: oldMap.imageName })
                })
            } catch (error) {
                console.error("Error occured while updating maps access level: ", error);
                return;
            }
        } else {
            copyLinkBtn.classList.remove('show');
            try {
                const oldResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json',
                        'bypass-tunnel-reminder': true,
                     }
                });
                oldMap = await oldResponse.json();
                const newResponse = await fetch(`${apiBaseUrl}/maps/${currMapId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'bypass-tunnel-reminder': true
                    },
                    body: JSON.stringify({ ownerId: oldMap.ownerId, title: oldMap.title, isPublic: false, imagePath: oldMap.imagePath, imageName: oldMap.imageName })
                })
            } catch (error) {
                console.error("Error occured while updating maps access level: ", error);
                return;
            }
        }
    });

    // Логика копирования в буфер обмена
    copyLinkBtn.addEventListener('click', () => {
        const textToCopy = `${frontBaseUrl}/public/?map=${currMapId}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Визуальный отклик для пользователя при успешном копировании
            const originalText = copyLinkBtn.textContent;
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = originalText;
            }, 1500);
        }).catch(err => {
            console.error('Error: ', err);
        });
    });
    
}
function hideTitle() {
    mapTitleInput.style.visibility = 'hidden';
    mapTitleInput.value = '';
}
function resetMap() {
    fileInput.value = ''; // Очищаем выбранный файл в инпуте
    fullPreview.src = ''; // Очищаем превью
    markersLayer.innerHTML = '';
    currMapId = null;
    hidePopups();
    hideTitle();
    
    // Переключаем видимость обратно
    viewArea.style.display = 'none';
    mainTitle.style.display = 'block';
    dropArea.style.display = 'flex';
    toggleAccess.style.display = 'none';
    copyLinkBtn.classList.remove('show');
}
// Возврат к загрузке при клике на "Отмена"
resetBtn.addEventListener('click', () => resetMap());

fullPreview.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    hidePopups();

    const rect = imageWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    popupPoint = { x, y };

    popup.classList.add('show');

    addLabelBtn.style.display = 'block';
    putLabelBtn.style.display = 'none';

    positionPopup(popup, x, y);
});

// При нажатии левой кнопкой мыши на свободное место карты убирается всплывающее окно
fullPreview.addEventListener('click', (e) => {
    hidePopups();
});

addLabelBtn.addEventListener('click', async () => {
    if (!popupPoint) return;

    let markImageName = null;
    let markImagePath = null;
    if (currMarkImage != null)
    {
        const imageUploadResponse = await s3Response(currMarkImage);
        markImageName = imageUploadResponse.imageName;
        markImagePath = imageUploadResponse.imageUrl;
        removeMarkImage();
    }

    try {
        const response = await fetch(`${apiBaseUrl}/landmarks`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'bypass-tunnel-reminder': true
            },
            body: JSON.stringify({ 
                mapId: currMapId, 
                title: titleInput.value, 
                description: descriptionInput.value, 
                x: Math.round(popupPoint.x),
                y: Math.round(popupPoint.y),
                size: parseInt(sizeResult.textContent, 10),
                markType: sizePreview.textContent,
                imagePath: markImagePath, 
                imageName: markImageName })
        });
        if (!response.ok) {
            throw new Error('Unexpected error.');
        }
        markId = await response.json();

        const point = new Point(
            markId,
            currMapId, 
            titleInput.value, 
            descriptionInput.value, 
            Math.round(popupPoint.x), 
            Math.round(popupPoint.y), 
            parseInt(sizeResult.textContent, 10), 
            sizePreview.textContent,
            markImagePath,
            markImageName
        );

        await createMarker(point);

        titleInput.value = '';
        descriptionInput.value = '';

        hidePopups();
    } catch (error) {
        console.error(error);
    }


    
    
});

deleteLabelBtn.addEventListener('click', async () => {
    if (!selectedMarkerId) return;
    try {
        const response = await fetch(`${apiBaseUrl}/landmarks/${selectedMarkerId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'bypass-tunnel-reminder': true
            }})
    } catch (error) {
        console.error(error);
        return;
    }
    
    document.querySelectorAll(`[data-id="${selectedMarkerId}"]`).forEach(el => el.remove());

    hidePopups();
});



const getUserId = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);

        const idKey = Object.keys(payload).find(key => key.includes('nameid'));
        const userId = payload[idKey] || payload.sub || payload.id;
        return userId;
    } catch (e) {
        console.error('Error occured while reading token:', e);
        localStorage.removeItem('authToken');
        window.location.href = 'login/';
        return;
    }
}

const s3Response = async (fileObject) => {
    const formData = new FormData();

    formData.append('file', fileObject);

    try {
        const response = await fetch(`${apiBaseUrl}/api/images/upload`, {
            method: 'POST',
            headers: {
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': true
                },
            body: formData
        });

        if (!response.ok){
            const errorText = await response.text();
            throw new Error('Unexpected error: ', errorText);
        }

        const data = await response.json();

        return data;
    } catch (error){
        console.error('Error occured during upload.');
    }
}

//sidebar logic
const menuBtn = document.getElementById('mainEmblem');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');


function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
    loadMapsList(getUserId(token));
});

async function loadMapsList(userId) {
    const sidebarContent = document.getElementById('sidebarContent');

    try {
        const response = await fetch(`${apiBaseUrl}/maps/user/${userId}`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': true
         }
        });

        if (!response.ok) {
            throw new Error(`Connection error: ${response.status}`);
        }

        const data = await response.json();

        sidebarContent.innerHTML = '';

        data.forEach(element => {
            // Add Title item
            const div = document.createElement('div');
            div.textContent = element.title;
            div.Id = element.id;
            div.addEventListener('click', async () => {
                currMapId = div.Id;
                await showMap(s3BaseUrl + element.imageName);
                await showTitle();
            });
            sidebarContent.append(div);
            // Add Delete Button item
            const delButton = document.createElement('button');
            delButton.textContent = '🗑';
            delButton.addEventListener('click', () => deleteMap(element.id, element.imageName));
            sidebarContent.append(delButton);
        });

    } catch (error) {
        console.error("Failed to load maps: ", error);
    }
    
}

async function uploadMap(file) {
    if (file.type.startsWith('image/')) {
        const ownerId = getUserId(token);

        const s3Data = await s3Response(file);
        
        try {
            const response = await fetch(`${apiBaseUrl}/maps`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'bypass-tunnel-reminder': true
                 },
                body: JSON.stringify({ ownerId: ownerId, title: "My Map", isPublic: false, imagePath: s3Data.imageUrl, imageName: s3Data.imageName })
            });
            if (!response.ok) {
                throw new Error('Unexpected error.');
            }
            currMapId = await response.json();
        } catch (error) {
            console.error(error);
        }
        await showMap(s3BaseUrl + s3Data.imageName);
        await showTitle();
    }
}

overlay.addEventListener('click', closeMenu);


// Map delete popup logic
async function deleteMap(id, imageName) {
    const popupOverlay = document.getElementById('deletePopupOverlay');
    const cancelBtn = document.getElementById('deleteMapCancelBtn');
    const confirmInput = document.getElementById('confirmInput');
    const confirmBtn = document.getElementById('deleteMapConfirmBtn');
    const deleteForm = document.getElementById('deletePopupForm');

    closeMenu();

    popupOverlay.classList.add('active');
    confirmInput.focus();

    function closePopup() {
        popupOverlay.classList.remove('active');
        deleteForm.reset();
        confirmBtn.disabled = true;
    }

    cancelBtn.addEventListener('click', closePopup);

    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            closePopup();
        }
    });

    confirmInput.addEventListener('input', (e) => {
        if (e.target.value.trim() === 'delete') {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = true;
        }
    });

    deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (confirmInput.value.trim() === 'delete') {
            confirmBtn.disabled = true;
            await fetch(`${apiBaseUrl}/maps/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': true
                } 
            });
            resetMap();
            closePopup();
        }
    })

}

// Mark change logic
const sizeIncrement = document.getElementById("sizeIncrement");
const sizeDecrement = document.getElementById("sizeDecrement");
const sizeResult = document.getElementById("sizeResult");
const sizePreview = document.getElementById("sizePreview");

sizeIncrement.addEventListener('click', () => {
    let currentFontSize = parseInt(sizeResult.textContent, 10);
    
    if(currentFontSize < 25) {
        currentFontSize++;

        sizeResult.textContent = currentFontSize;

        sizePreview.style.width = currentFontSize + 9 + 'px';
        sizePreview.style.height = currentFontSize + 9 + 'px';
        sizePreview.style.fontSize = currentFontSize + 'px';

    }
})

sizeDecrement.addEventListener('click', () => {
    let currentFontSize = parseInt(sizeResult.textContent, 10);
    
    if(currentFontSize > 10) {
        currentFontSize--;

        sizeResult.textContent = currentFontSize;

        sizePreview.style.width = currentFontSize + 9 + 'px';
        sizePreview.style.height = currentFontSize + 9 + 'px';
        sizePreview.style.fontSize = currentFontSize + 'px';

    }
})

// Mark image upload logic
const uploadMarkImageBox = document.getElementById('uploadMarkImageBox');
const markImageInput = document.getElementById('markImageInput');
const previewMarkImage = document.getElementById('previewMarkImage');
const uploadPlusIcon = document.getElementById('uploadPlusIcon');
const removeMarkImageBtn = document.getElementById('removeMarkImageBtn');

// Box click opens file explorer
uploadMarkImageBox.addEventListener('click', () => {
    if (markImageInput.files.length === 0) {
        markImageInput.click();
    }
});

markImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            previewMarkImage.src = e.target.result;
            previewMarkImage.style.display = 'block';
            uploadPlusIcon.style.display = 'none';
            removeMarkImageBtn.style.display = 'flex';
            uploadMarkImageBox.style.borderStyle = 'solid';
        }

        reader.readAsDataURL(file);

        currMarkImage = file;
    }
});

// 3. Image removal logic
removeMarkImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    markImageInput.value = '';
    previewMarkImage.src = '';
    previewMarkImage.style.display = 'none';
    uploadPlusIcon.style.display = 'block';
    removeMarkImageBtn.style.display = 'none';
    uploadMarkImageBox.style.borderStyle = 'dashed';
    currMarkImage = null;
});

function removeMarkImage() {
    markImageInput.value = '';
    previewMarkImage.src = '';
    previewMarkImage.style.display = 'none';
    uploadPlusIcon.style.display = 'block';
    removeMarkImageBtn.style.display = 'none';
    uploadMarkImageBox.style.borderStyle = 'dashed';
    currMarkImage = null;
}

const markerColorSelection = (markType) => {
    let rgb = null;
    switch (markType) {
        case "☠":
            rgb = "rgb(139, 26, 26)";
            break;
        case "⚗":
            rgb = "rgb(201, 148, 26)";
            break;
        case "⌂":
            rgb = "rgb(196, 169, 106)";
            break;
        case "★":
            rgb = "rgb(232, 213, 163)";
            break;
        case "⚔":
            rgb = "rgb(204, 51, 51)";
            break;
        case "📜":
            rgb = "rgb(255, 255, 255)";
            break;
        case "◆":
            rgb = "rgb(122, 106, 74)";
            break;
        case "⌖":
            rgb = "rgb(106, 158, 181)";
            break;
        case "▲":
            rgb = "rgb(74, 103, 65)";
            break;
        case "⊕":
            rgb = "rgb(122, 74, 154)";
            break;
        default:
            rgb = "rgb(255, 255, 255)"
            break;
    }
    return rgb;
}

const markType1 = document.getElementById('markType1');
const markType2 = document.getElementById('markType2');
const markType3 = document.getElementById('markType3');
const markType4 = document.getElementById('markType4');
const markType5 = document.getElementById('markType5');
const markType6 = document.getElementById('markType6');
const markType7 = document.getElementById('markType7');
const markType8 = document.getElementById('markType8');
const markType9 = document.getElementById('markType9');
const markType10 = document.getElementById('markType10');
markType1.addEventListener('click', () => {
    sizePreview.textContent = markType1.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType2.addEventListener('click', () => {
    sizePreview.textContent = markType2.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType3.addEventListener('click', () => {
    sizePreview.textContent = markType3.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType4.addEventListener('click', () => {
    sizePreview.textContent = markType4.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType5.addEventListener('click', () => {
    sizePreview.textContent = markType5.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType6.addEventListener('click', () => {
    sizePreview.textContent = markType6.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType7.addEventListener('click', () => {
    sizePreview.textContent = markType7.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType8.addEventListener('click', () => {
    sizePreview.textContent = markType8.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType9.addEventListener('click', () => {
    sizePreview.textContent = markType9.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})
markType10.addEventListener('click', () => {
    sizePreview.textContent = markType10.textContent;
    sizePreview.style.color = markerColorSelection(sizePreview.textContent);
})

updateLabelBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const markId = selectedMarkerId;
    hidePopups();

    const rect = imageWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    popupPoint = { x, y };

    popup.classList.add('show');

    addLabelBtn.style.display = 'none';
    putLabelBtn.style.display = 'block';

    positionPopup(popup, x, y);

    try {
        const response = await fetch(`${apiBaseUrl}/landmarks/${markId}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': true
         }
        });
        const data = await response.json();
        
        currPoint = new Point(
            data.id,
            data.mapId,
            data.title,
            data.description,
            data.x,
            data.y,
            data.size,
            data.markType,
            data.imagePath,
            data.imageName
        );

        titleInput.value = currPoint.Title;
        descriptionInput.value = currPoint.Description;
        sizePreview.textContent = currPoint.MarkType;
        sizeResult.textContent = currPoint.Size;
        sizePreview.style.width = currPoint.Size + 9 + 'px';
        sizePreview.style.height = currPoint.Size + 9 + 'px';
        sizePreview.style.fontSize = currPoint.Size + 'px';
        sizePreview.style.color = markerColorSelection(currPoint.MarkType);
        if (currPoint.ImagePath != null) {
            await loadImage(s3BaseUrl + currPoint.ImageName, previewMarkImage);
            previewMarkImage.style.display = 'block';
            uploadPlusIcon.style.display = 'none';
            removeMarkImageBtn.style.display = 'flex';
            uploadMarkImageBox.style.borderStyle = 'solid';
        }
    } catch(error) {
        console.log(error);
    }
})

putLabelBtn.addEventListener('click', async () => {

    let markImageName = null;
    let markImagePath = null;
    if (uploadPlusIcon.style.display == 'none'){
        markImageName = currPoint.ImageName;
        markImagePath = currPoint.ImagePath;
    }
    // To update
    if ((markImagePath != null && previewMarkImage.src != currPoint.ImagePath) //If there was image and it has been swapped
        || (currPoint.ImagePath == null && uploadPlusIcon.style.display == 'none')){ //If there was no image and it was added
        const imageUploadResponse = await uploadImageFromUrl(previewMarkImage.src);
        markImageName = imageUploadResponse.imageName;
        markImagePath = imageUploadResponse.imageUrl;
        removeMarkImage();
    }

    try {
        const response = await fetch(`${apiBaseUrl}/landmarks/${currPoint.Id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'bypass-tunnel-reminder': true
            },
            body: JSON.stringify({ 
                mapId: currPoint.MapId, 
                title: titleInput.value, 
                description: descriptionInput.value, 
                x: currPoint.X,
                y: currPoint.Y,
                size: parseInt(sizeResult.textContent, 10),
                markType: sizePreview.textContent,
                imagePath: markImagePath, 
                imageName: markImageName })
        });
        if (!response.ok) {
            throw new Error('Unexpected error.');
        }
        markId = await response.json();

        document.querySelectorAll(`[data-id="${markId}"]`).forEach(el => el.remove());

        const point = new Point(
            markId,
            currMapId, 
            titleInput.value, 
            descriptionInput.value, 
            currPoint.X, 
            currPoint.Y, 
            parseInt(sizeResult.textContent, 10), 
            sizePreview.textContent,
            markImagePath,
            markImageName
        );

        await createMarker(point);

        titleInput.value = '';
        descriptionInput.value = '';
        removeMarkImage();

        hidePopups();
    } catch (error) {
        console.error(error);
    }
})

const uploadImageFromUrl = async (imageUrl) => {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'bypass-tunnel-reminder': true }
        });

        if(!response.ok) {
            throw new Error(`Unable to download image: ${response.statusText}`);
        }

        const blob = await response.blob();

        const mimeExtensions = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg'
        };

        const ext = mimeExtensions[blob.type] || 'jpg';

        const filename = `image-${Date.now()}.${ext}`;

        const fileObject = new File([blob], filename, { type: blob.type });

        return await s3Response(fileObject);
    } catch (error) {
        console.error('Error occured during image processing:', error);
    }
}

async function loadImage(imageUrl, imgElementId) {
    const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
            'bypass-tunnel-reminder': 'true'
        }
    });

    if (!response.ok) throw new Error('Download error');

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);

    document.getElementById(imgElementId).src = objectURL;
}