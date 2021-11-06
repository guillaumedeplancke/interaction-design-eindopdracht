const apiKey = 'ZsNKAguxnB7VDiP5bJEaY1a9Lh8Ymx2D7nhxbdFD';
const apiUrl = 'https://telraam-api.net/v1';
const proxyUrl = 'https://cors.guillaume.cloud/';

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

const getAllSegments = () => {
    const endpoint = '/segments/all';
    const url = proxyUrl + apiUrl + endpoint;

    return fetch(url, {
        headers: {
            'X-Api-Key': apiKey,
        },
    })
        .then((response) => response.json())
        .then((data) => filterSegments(data));
};

const filterSegments = async (data) => {
    const userLocation = getUserCoordinates();
    const segments = data.features;

    let filteredSegments = [];

    for (const segment of segments) {
        let coordinates = segment.geometry.coordinates[0][0];

        // Source: https://gis.stackexchange.com/questions/58509/how-to-convert-epsg2163-coordinates-to-wgs84-in-javascript
        // Extra info: https://macwright.com/2015/03/23/geojson-second-bite.html
        let coordinates_converted = proj4('EPSG:31370', 'EPSG:4326', [coordinates[0], coordinates[1]]);

        if (isCoordinateInRange(coordinates_converted, userLocation, 2)) {
            let streetname = await getStreetnameFromCoordinates(coordinates_converted);
            console.log(segment);

            console.log(streetname.address.road + ' ' + streetname.address.city_district);

            filteredSegments[segment.properties.oidn] = streetname.address.road + ', ' + streetname.address.city_district;
        }
    }

    console.log('total: ' + filteredSegments.length);

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
    const url = 'http://open.mapquestapi.com/nominatim/v1/reverse.php?key=A8O7jLMI6RxfT7ccvE6AGG7bKAQ8iRwk&format=json&lat=' + coords[1] + '&lon=' + coords[0];

    let result = await fetch(url)
        .then((response) => response.json())
        .then((data) => data);

    return result;
};

const fillDropdownWithSegments = (segments) => {
    let segmentsDropdown = document.querySelector('.js-segments');

    segmentsDropdown.innerHTML = '';

    segments.forEach((streetname, id) => {
        // todo: check why the last items starting with 90000 are not being processed
        console.log(id);
        segmentsDropdown.innerHTML += "<option value='" + id + "'>" + streetname + '</option>';
    });
};

const dropdownItemChangedEvent = () => {
    let segmentsDropdown = document.querySelector('.js-segments');

    console.log('changed!');

    console.log(segmentsDropdown.value);

    // todo: get data
};

const getTrafficReportForSegment = (segmentId) => {};

const initFrontend = async () => {
    const data = await getAllSegments();

    await fillDropdownWithSegments(data);

    document.addEventListener('change', dropdownItemChangedEvent);

    console.log(data);
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded...');

    initFrontend();
});
