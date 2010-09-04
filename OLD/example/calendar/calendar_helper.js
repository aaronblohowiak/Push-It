var dateFields = "_end _start end start".split(' ');

function serializeEvent(e) {
	var copy = {};
	$.extend(copy, e);
	delete copy["source"];

	for (var i = dateFields.length - 1; i >= 0; i--) {
		var field = dateFields[i];
		if (copy[field]) copy[field] = copy[field].toString();
	};
	
	return copy;
}

function deserializeEvent(e) {
	try {
		for (var j = dateFields.length - 1; j >= 0; j--) {
			var field = dateFields[j];
			if (e[field] && (e[field] !== "null")) {
				e[field] = new Date(e[field]);
			} else {
				e[field] = null;
			}
		};

		//default to true
		if (e.allDay) e.allDay = (e.allDay == "true");
		if (e.editable) e.editable = (e.editable == "true");
		return e;
	}
	catch(err) {
		console.log(err);
		return e;
	}
}

function updateEvent(e) {
	sourceEvents = $('#calendar').fullCalendar('clientEvents', e.id);
	$(sourceEvents).each(function(i, source) {
		var remote = deserializeEvent(e);
		$.extend(source, remote);
		$('#calendar').fullCalendar('updateEvent', source);
	});
}
