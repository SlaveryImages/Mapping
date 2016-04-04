$(document).ready( function() {

var mappingMap = $('#mapping-map');
var mappingForm = $('#mapping-form');
var mappingData = mappingMap.data('mapping');
var markersData = mappingMap.data('markers');

// Initialise the map.
var map = L.map('mapping-map');
var mapDefaultCenter = [0, 0];
var mapDefaultZoom = 1;
if (mappingData) {
    if (mappingData['o-module-mapping:default_lat'] && mappingData['o-module-mapping:default_lng']) {
        mapDefaultCenter = [
            mappingData['o-module-mapping:default_lat'],
            mappingData['o-module-mapping:default_lng']
        ];
    }
    if (mappingData['o-module-mapping:default_zoom']) {
        mapDefaultZoom = mappingData['o-module-mapping:default_zoom'];
    }
}
map.setView(mapDefaultCenter, mapDefaultZoom);

// Initialise the selectable base maps.
var baseMaps = {
    'Streets': L.tileLayer.provider('OpenStreetMap.Mapnik'),
    'Grayscale': L.tileLayer.provider('OpenStreetMap.BlackAndWhite'),
    'Satellite': L.tileLayer.provider('Esri.WorldImagery'),
    'Terrain': L.tileLayer.provider('Esri.WorldShadedRelief')
};
// Initialize the layer control and pass it the base maps.
var layerControl = L.control.layers(baseMaps);
// Initialise the feature group to store editable layers
var drawnItems = new L.FeatureGroup();
// Initialise the draw control and pass it the feature group of editable layers
var drawControl = new L.Control.Draw({
    draw: {
        polyline: false,
        polygon: false,
        rectangle: false,
        circle: false
    },
    edit: {
        featureGroup: drawnItems
    }
});
var wms;
var opacityControl;

// Add the layers and controls to the map.
map.addLayer(baseMaps['Streets']);
map.addLayer(drawnItems);
map.addControl(layerControl);
map.addControl(drawControl);
map.addControl(L.control.fitBounds(drawnItems));
map.addControl(L.control.defaultView());

var addMarker = function(marker, markerId, markerLabel, markerMediaId) {

    // Build the marker popup content.
    var popupContent = $('.mapping-marker-popup-content').clone().show()
        .data('marker', marker)
        .data('selectedMediaId', markerMediaId);
    popupContent.find('.mapping-marker-popup-label').val(markerLabel);
    if (markerMediaId) {
        var mediaThumbnail = $('<img>', {
            src: $('.mapping-marker-image-select[value="' + markerMediaId + '"').data('mediaThumbnailUrl')
        });
        popupContent.find('.mapping-marker-popup-image').html(mediaThumbnail);
    }
    marker.bindPopup(popupContent[0]);

    // Prepare image selector when marker is clicked.
    marker.on('click', function(e) {
        Omeka.openSidebar($(this), '#mapping-marker-image-selector');
        var selectedMediaId = popupContent.data('selectedMediaId');
        if (selectedMediaId) {
            $('.mapping-marker-image-select[value="' + selectedMediaId + '"]').prop('checked', true);
        } else {
            $('.mapping-marker-image-select:first').prop('checked', true);
        }
    });

    // Close image selector when marker closes.
    marker.on('popupclose', function(e) {
        // Context must be within the sidebar, thus the ".children()"
        Omeka.closeSidebar($('#mapping-marker-image-selector').children());
    });

    // Add the marker layer before adding marker inputs so Leaflet sets an ID.
    drawnItems.addLayer(marker);

    // Add the corresponding marker inputs to the form.
    if (markerId) {
        mappingForm.append($('<input>')
            .attr('type', 'hidden')
            .attr('name', 'o-module-mapping:marker[' + marker._leaflet_id + '][o:id]')
            .val(markerId));
    }
    mappingForm.append($('<input>')
        .attr('type', 'hidden')
        .attr('name', 'o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:lat]')
        .val(marker.getLatLng().lat));
    mappingForm.append($('<input>')
        .attr('type', 'hidden')
        .attr('name', 'o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:lng]')
        .val(marker.getLatLng().lng));
    mappingForm.append($('<input>')
        .attr('type', 'hidden')
        .attr('name', 'o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:label]')
        .val(markerLabel));
    mappingForm.append($('<input>')
        .attr('type', 'hidden')
        .attr('name', 'o-module-mapping:marker[' + marker._leaflet_id + '][o:media][o:id]')
        .val(markerMediaId));

};

var editMarker = function(marker) {
    // Edit the corresponding marker form inputs.
    $('input[name="o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:lat]"]')
        .val(marker.getLatLng().lat);
    $('input[name="o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:lng]"]')
        .val(marker.getLatLng().lng);
}

var deleteMarker = function(marker) {
    // Remove the corresponding marker inputs from the form.
    $('input[name^="o-module-mapping:marker[' + marker._leaflet_id + ']"]').remove();
}

var setWms = function(baseUrl, layers, styles, label) {
    if (wms) {
        // Remove existing WMS overlay before setting another.
        map.removeLayer(wms);
        layerControl.removeLayer(wms);
    }
    // WMS layers and styles cannot be null.
    if (!layers) {
        layers = '';;
    }
    if (!styles) {
        styles = '';;
    }
    wms = L.tileLayer.wms(baseUrl, {
        layers: layers,
        styles: styles,
        format: 'image/png',
        transparent: true,
    }).addTo(map);
    if (!label) {
        label = 'Unlabeled Overlay';
        $('#mapping-wms-label').val(label)
    }
    layerControl.addOverlay(wms, label);
    if (opacityControl) {
        // Remove existing opacity control before setting another.
        map.removeControl(opacityControl);
    }
    opacityControl = L.control.opacity(wms, label);
    map.addControl(opacityControl);

    $('input[name="o-module-mapping:mapping[o-module-mapping:wms_base_url]"]').val(baseUrl);
    $('input[name="o-module-mapping:mapping[o-module-mapping:wms_layers]"]').val(layers);
    $('input[name="o-module-mapping:mapping[o-module-mapping:wms_styles]"]').val(styles);
    $('input[name="o-module-mapping:mapping[o-module-mapping:wms_label]"]').val(label);
}

// Add saved markers to the map.
$.each(markersData, function(index, data) {
    var latLng = L.latLng(data['o-module-mapping:lat'], data['o-module-mapping:lng']);
    var marker = L.marker(latLng);
    var markerMediaId = data['o:media'] ? data['o:media']['o:id'] : null;
    addMarker(marker, data['o:id'], data['o-module-mapping:label'], markerMediaId);
});

// Set saved mapping data to the map (default view and WMS overlay).
if (mappingData) {
    $('input[name="o-module-mapping:mapping[o:id]"]').val(mappingData['o:id']);
    $('input[name="o-module-mapping:mapping[o-module-mapping:default_lat]"]').val(mappingData['o-module-mapping:default_lat']);
    $('input[name="o-module-mapping:mapping[o-module-mapping:default_lng]"]').val(mappingData['o-module-mapping:default_lng']);
    $('input[name="o-module-mapping:mapping[o-module-mapping:default_zoom]"]').val(mappingData['o-module-mapping:default_zoom']);

    if (mappingData['o-module-mapping:wms_base_url']) {
        // WMS is valid only with a base URL.
        setWms(
            mappingData['o-module-mapping:wms_base_url'],
            mappingData['o-module-mapping:wms_layers'],
            mappingData['o-module-mapping:wms_styles'],
            mappingData['o-module-mapping:wms_label']
        );
    }
    $('#mapping-wms-base-url').val(mappingData['o-module-mapping:wms_base_url']),
    $('#mapping-wms-layers').val(mappingData['o-module-mapping:wms_layers']),
    $('#mapping-wms-styles').val(mappingData['o-module-mapping:wms_styles']),
    $('#mapping-wms-label').val(mappingData['o-module-mapping:wms_label'])
}

// Add new markers.
map.on('draw:created', function (e) {
    var type = e.layerType;
    var layer = e.layer;
    if (type === 'marker') {
        addMarker(layer);
    }
});

// Edit existing (saved and unsaved) markers.
map.on('draw:edited', function (e) {
    var layers = e.layers;
    layers.eachLayer(function (layer) {
        editMarker(layer);
    });
});

// Delete existing (saved and unsaved) markers.
map.on('draw:deleted', function (e) {
    var layers = e.layers;
    layers.eachLayer(function (layer) {
        deleteMarker(layer);
    });
});

// Switching sections changes map dimensions, so make the necessary adjustments.
$('a[href="#mapping-section"], #mapping-legend').on('click', function(e) {
    map.invalidateSize();
});

// Update corresponding form input when updating a marker label.
mappingMap.on('keyup', '.mapping-marker-popup-label', function(e) {
    var thisInput = $(this);
    var marker = thisInput.closest('.mapping-marker-popup-content').data('marker');
    var labelInput = $('input[name="o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:label]"]');
    labelInput.val(thisInput.val());
});

// Handle media image selection.
$('input.mapping-marker-image-select').on('change', function(e) {
    var thisInput = $(this);
    var popupContent = $('.mapping-marker-popup-content:visible');
    var marker = popupContent.data('marker');

    // Render thumbnail in popup content.
    var mediaThumbnail = null;
    var mediaThumbnailUrl = thisInput.data('mediaThumbnailUrl');
    if (mediaThumbnailUrl) {
        var mediaThumbnail = $('<img>', {src: mediaThumbnailUrl});
    }
    popupContent.find('.mapping-marker-popup-image').html(mediaThumbnail);
    popupContent.data('selectedMediaId', thisInput.val());

    // Update corresponding form input when updating an image.
    var mediaIdInput = $('input[name="o-module-mapping:marker[' + marker._leaflet_id + '][o:media][o:id]"]');
    mediaIdInput.val(thisInput.val());

    // Set the media title as the popup label if not already set.
    var mediaTitle = thisInput.data('mediaTitle');
    var popupLabel = popupContent.find('.mapping-marker-popup-label');
    if (!popupLabel.val()) {
        var labelInput = $('input[name="o-module-mapping:marker[' + marker._leaflet_id + '][o-module-mapping:label]"]');
        labelInput.val(mediaTitle);
        popupLabel.val(mediaTitle);
    }
});

// Unset the WMS overlay.
$('#mapping-wms-unset').on('click', function(e) {
    e.preventDefault();
    if (wms) {
        map.removeLayer(wms);
        map.removeControl(opacityControl);
        layerControl.removeLayer(wms);
        // Remove the WMS overlay and opacity control completely.
        wms = null;
        opacityControl = null;
    }
    $('input[name^="o-module-mapping:mapping[o-module-mapping:wms_').val('');
    $('#mapping-wms-base-url, #mapping-wms-layers, #mapping-wms-styles, #mapping-wms-label').val('');
});

// Set the WMS overlay.
$('#mapping-wms-set').on('click', function(e) {
    e.preventDefault();
    setWms(
        $('#mapping-wms-base-url').val(),
        $('#mapping-wms-layers').val(),
        $('#mapping-wms-styles').val(),
        $('#mapping-wms-label').val()
    );
});

});
