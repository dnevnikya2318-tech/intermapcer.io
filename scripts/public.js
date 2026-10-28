const fullPreview = document.getElementById('fullPreview');
const imageWrapper = document.getElementById('imageWrapper');
const markersLayer = document.getElementById('markersLayer');
const mapTitleInput = document.getElementById('mapTitleInput');

let currMapId = null;
let configResponse = null;
let config = null;
let apiBaseUrl = null;
let s3BaseUrl = null;

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
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('map');
    const logoutBtn = document.getElementById('logoutBtn');
    const preloader = document.getElementById('pagePreloader');
    
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = '../login/';
        })
    }

    if (!fileId) {
        console.error('No file ID in URL!');
        window.location.href = '../login/';
        return;
    }

    try {
        configResponse = await fetch('../config.json');
        if(!configResponse.ok) throw new Error('Failed to load config');
        config = await configResponse.json();

        apiBaseUrl = config.API_BASE_URL;
        s3BaseUrl = config.S3_BASE_URL;
        const backendUrl = `${apiBaseUrl}/maps/public/${fileId}`

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'bypass-tunnel-reminder': 'true'
            }
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        await renderPublicData(data);

        if (preloader) {
            preloader.classList.add('done');
        }
    } catch (error) {
        console.error('Error occured during loading:', error)
        if (preloader)
        {
            preloader.innerHTML = '<div class="error-msg">Loading error. Please, try again later.</div>'
        }
    }  
});

async function renderPublicData(data) {
    currMapId = data.id;
    mapTitleInput.value = data.title;
    await showMap(s3BaseUrl + data.imageName);
}

function hidePopups() {
    const labelPopups = document.querySelectorAll('.marker-label');
    labelPopups.forEach(el => {
        el.style.display = 'none';
    });
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

async function showMap(filePath) {
    await loadImage(filePath, fullPreview);

    markersLayer.innerHTML = '';

    try {
        const response = await fetch(`${apiBaseUrl}/landmarks/map/${currMapId}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true'
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

// При вызове функция создаёт на карте маркеры и соответствующие им описания
async function createMarker(point) {
    const id = point.Id;

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.id = id;
    marker.style.left = `${point.X}%`;
    marker.style.top = `${point.Y}%`;
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
    if (point.ImagePath != null)
    {
        const labelImg = document.createElement('img');
        await loadImage(s3BaseUrl + point.ImageName, labelImg);
        label.appendChild(labelImg);
    }

    
    label.className = 'marker-label';
    label.dataset.id = id;
    label.style.left = `${point.X}%`;
    label.style.top = `${point.Y}%`;
    label.style.display = 'none';

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

// При нажатии левой кнопкой мыши на свободное место карты убирается всплывающее окно
fullPreview.addEventListener('click', (e) => {
    hidePopups();
});

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

    imgElementId.src = objectURL;
}