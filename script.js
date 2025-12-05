const cityInput = document.querySelector("#cityInput");
const searchIcon = document.querySelector("#searchIcon");
const historyContainer = document.querySelector("#historyContainer");
const clearHistoryBtn = document.querySelector("#clearHistoryBtn");

const cityNameElem = document.querySelector("#cityName");
const temperatureElem = document.querySelector("#temperature");
const weatherTextElem = document.querySelector("#weatherText");
const sunriseElem = document.querySelector("#sunrise");
const sunsetElem = document.querySelector("#sunset");
const windElem = document.querySelector("#wind");
const humidityElem = document.querySelector("#humidity");
const forecastContainer = document.querySelector("#forecastContainer");
const errorElem = document.querySelector("#errorMessage");

function levenshtein(a, b) {
    const m = [];
    let i, j;
    if (!(a && b)) return (b || a).length;
    for (i = 0; i <= b.length; m[i] = [i++]);
    for (j = 0; j <= a.length; m[0][j] = j++);
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            m[i][j] = b.charAt(i-1) === a.charAt(j-1)
                ? m[i-1][j-1]
                : Math.min(m[i-1][j-1]+1, Math.min(m[i][j-1]+1, m[i-1][j]+1));
        }
    }
    return m[b.length][a.length];
}

function smartCityName(rawName) {
    const clean = rawName.trim().toLowerCase();
    if (clean.length < 3) return rawName;
    const worldCities = [
        "Bishkek","Moscow","Saint Petersburg","Osh","Almaty",
        "Astana","Tashkent","New York","London","Paris",
        "Berlin","Tokyo","Seoul","Dubai","Madrid","Rome",
        "Los Angeles","Chicago"
    ];
    let best = rawName, bestScore = Infinity;
    worldCities.forEach(city => {
        const score = levenshtein(clean, city.toLowerCase());
        if(score < bestScore){ bestScore = score; best = city; }
    });
    return bestScore <= 2 ? best : rawName;
}

function weatherCodeToText(code){
    const map = {
        0:["Ясно","☀️"],1:["Преимущественно ясно","🌤️"],2:["Переменная облачность","⛅"],
        3:["Облачно","☁️"],45:["Туман","🌫️"],48:["Морозный туман","🌫️"],51:["Морось","🌦️"],
        53:["Морось","🌦️"],55:["Морось","🌧️"],61:["Дождь","🌧️"],63:["Дождь","🌧️"],
        65:["Сильный дождь","🌧️"],71:["Снег","❄️"],73:["Снег","❄️"],75:["Сильный снег","❄️"],
        80:["Ливень","🌧️"],81:["Ливень","🌧️"],82:["Сильный ливень","🌧️"],95:["Гроза","⛈️"],
        96:["Гроза с градом","⛈️"],99:["Гроза с крупным градом","⛈️"]
    };
    return map[code]||["Неизвестно","❓"];
}

let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]");

function updateHistory() {
    historyContainer.innerHTML = "";
    searchHistory.forEach(city => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.textContent = city;
        item.addEventListener("click", () => {
            cityInput.value = city;
            loadWeather(city);
        });
        historyContainer.appendChild(item);
    });
}

function addToHistory(city) {
    if(!city || searchHistory.includes(city)) return;
    searchHistory.unshift(city);
    if(searchHistory.length > 5) searchHistory.pop();
    localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
    updateHistory();
}

clearHistoryBtn.addEventListener("click", () => {
    searchHistory = [];
    localStorage.removeItem("searchHistory");
    updateHistory();
});

async function loadWeather(city) {
    try {
        errorElem.textContent = "";

        const fixedCity = smartCityName(city);

        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(fixedCity)}&count=1&language=ru`);
        const geoData = await geoRes.json();
        if(!geoData.results || geoData.results.length===0) throw new Error("Город не найден");

        const place = geoData.results[0];
        const lat = place.latitude;
        const lon = place.longitude;

        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&current_weather=true&timezone=auto`
        );
        const weatherData = await weatherRes.json();

        renderCurrent(place.name, place.country, weatherData.current_weather, weatherData.daily);
        renderForecast(weatherData.daily);

        addToHistory(fixedCity);
        localStorage.setItem("last_city", fixedCity);

    } catch(e) {
        console.error(e);
        errorElem.textContent = e.message;
    }
}

function renderCurrent(city, country, current, daily){
    cityNameElem.textContent = `${city}, ${country}`;
    temperatureElem.textContent = `${current.temperature}°C`;
    const [text, emoji] = weatherCodeToText(current.weathercode);
    weatherTextElem.textContent = emoji + " " + text;

    sunriseElem.textContent = daily.sunrise[0].split("T")[1];
    sunsetElem.textContent = daily.sunset[0].split("T")[1];
    windElem.textContent = current.windspeed + " км/ч";
    humidityElem.textContent = "—";
}

function renderForecast(daily){
    forecastContainer.innerHTML = "";
    // Показываем только первые 3 дня
    for(let i=0; i<Math.min(3, daily.time.length); i++){
        const [text, emoji] = weatherCodeToText(daily.weathercode[i]);
        const card = document.createElement("div");
        card.className = "forecast-item";
        card.innerHTML = `
            <div class="forecast-date">${daily.time[i]}</div>
            <div class="forecast-icon">${emoji}</div>
            <div class="forecast-desc">${text}</div>
            <div class="forecast-temp">${Math.round(daily.temperature_2m_min[i])}° / ${Math.round(daily.temperature_2m_max[i])}°</div>
        `;
        forecastContainer.appendChild(card);
    }
}

searchIcon.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if(city) loadWeather(city);
});

cityInput.addEventListener("keydown", e => {
    if(e.key === "Enter") {
        const city = cityInput.value.trim();
        if(city) loadWeather(city);
    }
});

const lastCity = localStorage.getItem("last_city") || "Bishkek";
cityInput.value = lastCity;
loadWeather(lastCity);
updateHistory();