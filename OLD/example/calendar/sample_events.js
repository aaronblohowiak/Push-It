(function(){
  var date = new Date();
  var d = date.getDate();
  var m = date.getMonth();
  var y = date.getFullYear();

  window.sampleEvents = [

  {
  	id: 323,
  	title: 'All Day Event',
  	start: new Date(y, m, 1)
  },
  { 
    id:111,
  	title: 'Long Event',
  	start: new Date(y, m, d - 5),
  	end: new Date(y, m, d - 2)
  },
  {
  	id: 999,
  	title: 'Repeating Event',
  	start: new Date(y, m, d - 3, 16, 0),
  	allDay: false
  },
  {
  	id: 999,
  	title: 'Repeating Event',
  	start: new Date(y, m, d + 4, 16, 0),
  	allDay: false
  },
  {
  	id: 222,
  	title: 'Meeting',
  	start: new Date(y, m, d, 10, 30),
  	allDay: false
  },
  {
  	id: 532,
  	title: 'Lunch',
  	start: new Date(y, m, d, 12, 0),
  	end: new Date(y, m, d, 14, 0),
  	allDay: false
  },
  {
  	id: 913,
  	title: 'Birthday Party',
  	start: new Date(y, m, d + 1, 19, 0),
  	end: new Date(y, m, d + 1, 22, 30),
  	allDay: false
  },
  {
  	id: 213,
  	title: 'Click for Google',
  	start: new Date(y, m, 28),
  	end: new Date(y, m, 29),
  	url: 'http://google.com/'
  }

  ];
})();
