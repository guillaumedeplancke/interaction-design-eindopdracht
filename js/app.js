const apiKey = 'ZsNKAguxnB7VDiP5bJEaY1a9Lh8Ymx2D7nhxbdFD';
const apiUrl = 'https://telraam-api.net/v1';
const proxyUrl = 'https://cors.guillaume.cloud/';

let currentDisplayDate, datepicker;
let reportView, loadingView;
let segmentsDropdown, dateInput, progressBar, statusMessage;
let pedestriansCount, bikersCount, carsCount, trucksCount;
let pedestriansVisual, bikersVisual, carsVisual, trucksVisual;

// Source: https://epsg.io/31370
var be_proj =
    'PROJCS["Belge 1972 / Belgian Lambert 72", GEOGCS["Belge 1972", DATUM["Reseau_National_Belge_1972", SPHEROID["International 1924",6378388,297, AUTHORITY["EPSG","7022"]], TOWGS84[-106.869,52.2978,-103.724,0.3366,-0.457,1.8422,-1.2747], AUTHORITY["EPSG","6313"]], PRIMEM["Greenwich",0, AUTHORITY["EPSG","8901"]], UNIT["degree",0.0174532925199433, AUTHORITY["EPSG","9122"]], AUTHORITY["EPSG","4313"]], PROJECTION["Lambert_Conformal_Conic_2SP"], PARAMETER["standard_parallel_1",51.16666723333333], PARAMETER["standard_parallel_2",49.8333339], PARAMETER["latitude_of_origin",90], PARAMETER["central_meridian",4.367486666666666], PARAMETER["false_easting",150000.013], PARAMETER["false_northing",5400088.438], UNIT["metre",1, AUTHORITY["EPSG","9001"]], AXIS["X",EAST], AXIS["Y",NORTH], AUTHORITY["EPSG","31370"]]';
proj4.defs('EPSG:31370', be_proj);

const getUserCoordinates = () => {
    return {
        lat: '50.8509439',
        long: '3.3066192',
    };
};

const getAllSegmentsFiltered = () => {
    const endpoint = '/segments/all';
    const url = proxyUrl + apiUrl + endpoint;

    statusMessage.innerHTML = "Fetching all segments...";

    return fetch(url, {
        headers: {
            'X-Api-Key': apiKey,
        },
    })
        .then((response) => response.json())
        .then((data) => filterSegments(data));
};

const getCameraForSegment = async (segmentId) => {
    const endpoint = '/cameras/segment/' + segmentId;
    const url = proxyUrl + apiUrl + endpoint;

    let result = await fetch(url, {
        headers: {
            'X-Api-Key': apiKey,
        },
    })
        .then((response) => response.json())
        .then((data) => data);

    return result;
};

const filterSegments = async (data) => {
    progressBar.value += 20;

    const today = new Date();
    const userLocation = getUserCoordinates();
    const segments = data.features;

    let segmentsNearby = [];

    // Filter step 1: only get camera's nearby user location
    statusMessage.innerHTML = "Filtering camera's...";

    for (const segment of segments) {
        let coordinates = segment.geometry.coordinates[0][0];

        // Source: https://gis.stackexchange.com/questions/58509/how-to-convert-epsg2163-coordinates-to-wgs84-in-javascript
        // Extra info: https://macwright.com/2015/03/23/geojson-second-bite.html
        let coordinates_converted = proj4('EPSG:31370', 'EPSG:4326', [coordinates[0], coordinates[1]]);

        if (isCoordinateInRange(coordinates_converted, userLocation, 2)) {
            segmentsNearby.push({
                "id": segment.properties.oidn,
                "coordinates": coordinates_converted
            });
            //segmentsNearby[segment.properties.oidn] = coordinates_converted;
        }
    }

    let activeSegments = [];

    // Filter step 2: only get camera's which were active last month
    statusMessage.innerHTML = "Filtering inactive camera's...";

    for (const segment of segmentsNearby) {    
        let id = segment['id'],
            coordinates = segment['coordinates'];

        let cameraResults = await getCameraForSegment(id);

        if (cameraResults.camera && cameraResults.camera.length > 0) {
            let latestImage = cameraResults.camera[0].last_data_package;
            // note: the 'camera' array can contain multiple camera's, when achieving to few result it may be interesting to also look to the other camera's

            if (latestImage) {
                let latestImageDate = new Date(Date.parse(latestImage));

                if (today.getMonth() === latestImageDate.getMonth()) {
                    console.log(segment);

                    activeSegments.push(segment);
                }
            }
        }

        progressBar.value += Math.ceil(25 / segmentsNearby.length);
    }

    let filteredSegments = [];

    // Step 3: fetch location (streetname & city) for each camera
    statusMessage.innerHTML = "Fetching camera locations...";

    for (const segment of activeSegments) {
        let id = segment.id,
            coordinates = segment.coordinates;
        
        let streetname = await getStreetnameFromCoordinates(coordinates);

        console.log(streetname.address.road + ' ' + streetname.address.city_district);

        filteredSegments[id] = streetname.address.road + ', ' + streetname.address.city_district;

        progressBar.value += Math.ceil(50 / activeSegments.length);
    }

    return filteredSegments;
};

// Source: https://stackoverflow.com/a/24680708
const isCoordinateInRange = (checkPoint, centerPoint, km) => {
    let ky = 40000 / 360;
    let kx = Math.cos((Math.PI * centerPoint.lat) / 180.0) * ky;
    let dx = Math.abs(centerPoint.long - checkPoint[0]) * kx;
    let dy = Math.abs(centerPoint.lat - checkPoint[1]) * ky;
    return Math.sqrt(dx * dx + dy * dy) <= km;
};

const getStreetnameFromCoordinates = async (coords) => {
    //const url = 'https://nominatim.openstreetmap.org/reverse?lon=' + coords[0] + '&lat=' + coords[1] + '&format=json';
    const url = 'https://open.mapquestapi.com/nominatim/v1/reverse.php?key=A8O7jLMI6RxfT7ccvE6AGG7bKAQ8iRwk&format=json&lat=' + coords[1] + '&lon=' + coords[0];

    let result = await fetch(url)
        .then((response) => response.json())
        .then((data) => data);

    return result;
};

const fillDropdownWithSegments = (segments) => {
    segmentsDropdown.innerHTML = '';

    segmentsDropdown.innerHTML += "<option selected disabled>Choose a segment...</option>";

    for (var item in segments) {
        let id = item,
            streetname = segments[id];

        segmentsDropdown.innerHTML += "<option value='" + id + "'>" + streetname + '</option>';
    }
};

const getTrafficForSegment = async (oidn) => {
    const endpoint = '/reports/traffic';
    const url = proxyUrl + apiUrl + endpoint;

    let startTime = new Date(currentDisplayDate);
    startTime.setHours(0, 0);

    let stopTime = new Date(currentDisplayDate);
    stopTime.setHours(23, 59);

    return await fetch(url, {
        method: 'POST',
        headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            level: 'segments',
            format: 'per-hour',
            id: oidn,
            time_start: startTime,
            time_end: stopTime,
        }),
    })
        .then((response) => response.json())
        .then((data) => data);
};

const getTrafficReportSummary = (report) => {
    let total_pedestrians = 0,
        total_bikers = 0,
        total_cars = 0,
        total_heavy = 0;

    report.forEach((item) => {
        total_pedestrians += item.pedestrian;
        total_bikers += item.bike;
        total_cars += item.car;
        total_heavy += item.heavy;
    });

    return {
        pedestrians: Math.round(total_pedestrians),
        bikes: Math.round(total_bikers),
        cars: Math.round(total_cars),
        heavy: Math.round(total_heavy),
    };
};

const showTrafficReport = (summary) => {
    pedestriansCount.innerHTML = summary.pedestrians;
    bikersCount.innerHTML = summary.bikes;
    carsCount.innerHTML = summary.cars;
    trucksCount.innerHTML = summary.heavy;

    let totalTraffic = summary.pedestrians + summary.bikes + summary.cars + summary.heavy;

    let pedestrainPercentage = (summary.pedestrians / totalTraffic) * 100,
        bikersPercentage = (summary.bikes / totalTraffic) * 100,
        carsPercentage = (summary.cars / totalTraffic) * 100,
        trucksPercentage = (summary.heavy / totalTraffic) * 100;

    if (summary.pedestrians >= 1) {
        pedestriansVisual.style.width = (pedestrainPercentage > 10 ? pedestrainPercentage : 10) + "%";
        pedestriansCount.innerHTML += " (" + Math.round(pedestrainPercentage) + "%)";
    } else pedestriansVisual.style.width = "0%";

    if (summary.bikes >= 1) {
        bikersVisual.style.width = (bikersPercentage > 10 ? bikersPercentage : 10) + "%";
        bikersCount.innerHTML += " (" + Math.round(bikersPercentage)  + "%)";
    } else bikersVisual.style.width = "0%";

    if (summary.cars >= 1) {
        carsVisual.style.width = (carsPercentage > 10 ? carsPercentage : 10) + "%";
        carsCount.innerHTML += " (" + Math.round(carsPercentage)  + "%)";
    } else carsVisual.style.width = "0%";

    if (summary.heavy >= 1) {
        trucksVisual.style.width = (trucksPercentage > 10 ? trucksPercentage : 10) + "%";
        trucksCount.innerHTML += " (" + Math.round(trucksPercentage)  + "%)";
    } else trucksVisual.style.width = "0%";
};

const dropdownItemChangedEvent = async () => {
    console.log('changed!');

    console.log(segmentsDropdown.value);

    updateTrafficReport();
};

const updateTrafficReport = async () => {
    const data = await getTrafficForSegment(segmentsDropdown.value);

    const reportSummary = getTrafficReportSummary(data.report);

    console.log(reportSummary);

    showTrafficReport(reportSummary);
};

const getTrafficReportForSegment = (segmentId) => {};

const previousDayButtonClickedEvent = () => {
    console.log("previous");

    currentDisplayDate.setDate(currentDisplayDate.getDate() - 1);

    datepicker.setDate(currentDisplayDate);
};

const nextDayButtonClickedEvent = () => {
    console.log("next");

    if (currentDisplayDate.getDate() != new Date().getDate() || currentDisplayDate.getMonth() != new Date().getMonth()) {
        currentDisplayDate.setDate(currentDisplayDate.getDate() + 1);
    } else {
        dateInput.classList.add("c-datepicker__shake");

        dateInput.addEventListener("animationend", e => {
            e.target.classList.remove("c-datepicker__shake");
        });
    }

    datepicker.setDate(currentDisplayDate);
};

const initFrontend = async () => {
    statusMessage.innerHTML = "Initializing frontend...";

    currentDisplayDate = new Date(); // set date of today as default display date

    datepicker = new Pikaday({
        field: dateInput,
        defaultDate: new Date(),
        setDefaultDate: true,
        maxDate: new Date(),
        format: 'D/M/YYYY',
        toString(date, format) {
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        },
        onSelect: function(date) {
            currentDisplayDate = date;
        }
    });

    document.querySelector(".js-previous-day").addEventListener('click', previousDayButtonClickedEvent);
    document.querySelector(".js-next-day").addEventListener('click', nextDayButtonClickedEvent);

    progressBar.value += 5;

    const data = await getAllSegmentsFiltered();

    statusMessage.innerHTML = "Filling dropdown...";

    await fillDropdownWithSegments(data);

    statusMessage.innerHTML = "There you go!";

    segmentsDropdown.addEventListener('change', dropdownItemChangedEvent);
    dateInput.addEventListener('change', updateTrafficReport);

    loadingView.classList.add('u-display-none');
    reportView.classList.remove('u-display-none');

    console.log(data);
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded...');

    loadingView = document.querySelector('.js-loading-view');
    reportView = document.querySelector('.js-report-view');

    statusMessage = document.querySelector('.js-status-message');
    segmentsDropdown = document.querySelector('.js-segments');
    progressBar = document.querySelector('.js-progress');
    dateInput = document.querySelector(".js-date");

    pedestriansCount = document.querySelector('.js-pedestrians .js-counter'),
    bikersCount = document.querySelector('.js-bikes .js-counter'),
    carsCount = document.querySelector('.js-cars .js-counter'),
    trucksCount = document.querySelector('.js-trucks .js-counter');

    pedestriansVisual = document.querySelector('.js-pedestrians .js-visual'),
    bikersVisual = document.querySelector('.js-bikes .js-visual'),
    carsVisual = document.querySelector('.js-cars .js-visual'),
    trucksVisual = document.querySelector('.js-trucks .js-visual');

    pedestriansVisual.style.width = "0%";
    bikersVisual.style.width = "0%";
    carsVisual.style.width = "0%";
    trucksVisual.style.width = "0%";

    initFrontend();
});
