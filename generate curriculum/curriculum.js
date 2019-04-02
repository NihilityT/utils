function save_file(value, type, title) {
	let blob;
	if (typeof window.Blob == "function") {
		blob = new Blob([value], {type: type});
	} else {
		let BlobBuilder = window.BlobBuilder || window.MozBlobBuilder ||
			window.WebKitBlobBuilder || window.MSBlobBuilder;
		let bb = new BlobBuilder();
		bb.append(value);
		blob = bb.getBlob(type);
	}
	let URL = window.URL || window.webkitURL;
	let bloburl = URL.createObjectURL(blob);
	let anchor = document.createElement("a");
	if ('download' in anchor) {
		anchor.href = bloburl;
		anchor.download = title;
		anchor.click();
	} else if (navigator.msSaveBlob) {
		navigator.msSaveBlob(blob, title);
	} else {
		location.href = bloburl;
	}
}

function curry(fn, arity = fn.length, ...args) {
	if (args.length < arity)
		return curry.bind(null, fn, arity, ...args);

	return fn(...args);
}

function compose(...fns) {
	return fns.reduce((f, g) => (...args) => f(g(...args)));
}

var flat = curry(lst => Array.prototype.concat.apply([], lst));

var path = curry((paths, obj) => {
	for (let p of paths) {
		if (obj == null)
			return obj;
		obj = obj[p];
	};
	return obj;
});

var prop = curry((p, obj) => path([p], obj));

var replace = curry((reg, rep, obj) => obj.replace(reg, rep));

var match = curry((reg, obj) => obj.match(reg));

var join = curry((con, obj) => obj.join(con));

var split = curry((separator, obj) => obj.split(separator));

var map = curry((fn, obj) => obj.map(fn));

var filter = curry((pred, obj) => obj.filter(pred));

var identity = curry((x) => x);
var always = curry((x) => () => x);

var add = curry((a, b) => Number(a) + Number(b));
var inc = add(1);
var dec = add(-1);

var trace = curry((x) => { console.log(x); return x;});

var slice = curry((begin, end, lst) => Array.prototype.slice.call(lst, begin, end));

var nth = curry((offset, lst) => {
	let idx = offset < 0 ? lst.length + offset : offset;
	return lst[idx];
});

var head = nth(0);
var last = nth(-1);
var init = slice(0, -1);
var tail = slice(1, Infinity);

var not = curry((pred) => !pred);
var equal = curry((a, b) => a == b);

var nullp = curry((obj) => equal(obj, null) || equal(prop('length', obj), 0));

var zip = curry((lst) => {
	if (nullp(head(lst)))
		return [];

	return [map(head, lst)].concat(zip(map(tail, lst)));
});

var when = curry((pred, fn, obj) => pred(obj) ? fn(obj) : obj);
var unless = curry((pred, fn, obj) => pred(obj) ? obj : fn(obj));
var ifelse = curry((pred, fn_true, fn_false, obj) =>
				   pred(obj) ? fn_true(obj) : fn_false(obj));

var intervalp = curry(lst => {
	if (nullp(lst) || isNaN(Number(prop(0, lst))))
		return null;

	if (lst.length === 1)
		return 1;

	let interval = lst[1] - lst[0];

	for (let i = 2; i < lst.length; i++)
		if (not(equal(prop(0, lst) + i * interval,
					  prop(i, lst))))
			return null;

	return interval;
});

var fixnum = curry((length, num) => {
	let numlength = num.toString().length;
	return numlength < length ?
		new Array(length - numlength + 1).join('0') + num :
		'' + num;
});

var REPEAT_MODE = {
	"SECONDLY": "SECONDLY",
	"MINUTELY": "MINUTELY",
	"HOURLY":   "HOURLY",
	"DAILY":    "DAILY",
	"WEEKLY":   "WEEKLY",
	"MONTHLY":  "MONTHLY",
	"YEARLY":   "YEARLY",
};

/*
 * repeat_ranges: [[1, 1], [3, 4], ...]
 * times: [[[08, 00], [09, 00]], ...]
 */
function Event(day, times,
			   title = '', note = '', location = '',
			   repeat_ranges = [[1, 1]], repeat_interval = 1,
			   repeat_mode = REPEAT_MODE.WEEKLY) {
	return {
		title: title,
		note: note,
		location: location,

		day: day,
		times: times,
		repeat_ranges: repeat_ranges,

		repeat_interval: repeat_interval,
		repeat_mode: repeat_mode,
	}
}

var date_offset = function (date, offset) {
	offset = Object.assign({
						   ms: 0, sec: 0, min: 0, hour: 0,
						   day: 0, week: 0, month: 0,
						   year: 0,
	}, offset);

	const newdate = new Date(date);

	newdate.setUTCMilliseconds(newdate.getUTCMilliseconds() + offset.ms);
	newdate.setUTCSeconds(newdate.getUTCSeconds() + offset.sec);
	newdate.setUTCMinutes(newdate.getUTCMinutes() + offset.min);
	newdate.setUTCHours(newdate.getUTCHours() + offset.hour);
	newdate.setUTCDate(newdate.getUTCDate() + offset.day + offset.week * 7);
	newdate.setUTCMonth(newdate.getUTCMonth() + offset.month);
	newdate.setUTCFullYear(newdate.getUTCFullYear() + offset.year);

	return newdate;
}

var remove_date_symbol_z = replace(/[-:.zZ]/g, '');

var to_iCalendar = curry((date, event) => {
	let ics = [];
	let _2 = fixnum(2);
	let encode = compose(replace(/%/g, ''), encodeURIComponent);
	let MODE_KEY = {
		"SECONDLY": "sec",
		"MINUTELY": "min",
		"HOURLY":   "hour",
		"DAILY":    "day",
		"WEEKLY":   "week",
		"MONTHLY":  "month",
		"YEARLY":   "year",
	};
	let modekey = MODE_KEY[event.repeat_mode];

	let interval = event.repeat_interval;
	for (let range of event.repeat_ranges) {
		let first_range = head(range) || range;
		let last_range  = last(range) || range;

		for (let time of event.times) {
			let start_time = time[0];
			let end_time = time[1];
			let first_section = head(time) || time;
			let last_section  = last(time) || time;

			let start_offset = {
				day: dec(event.day),
				hour: start_time[0],
				min: start_time[1],
			};
			let end_offset = {
				day: dec(event.day),
				hour: end_time[0],
				min: end_time[1],
			};
			start_offset[modekey] = dec(first_range) + (start_offset[modekey] || 0);
			end_offset[modekey]   = dec(first_range) + (end_offset[modekey]   || 0);

			let start_date = date_offset(date, start_offset);
			let end_date = date_offset(date, end_offset);


			ics.push(join(newline, [
				'BEGIN:VEVENT',

				'SUMMARY:' + event.title,
				'DESCRIPTION:' + event.note,
				'LOCATION:' + event.location,

				'DTSTART;TZID=Asia/Shanghai:' +
				remove_date_symbol_z(start_date.toISOString()),

				'DTEND;TZID=Asia/Shanghai:' +
				remove_date_symbol_z(end_date.toISOString()),

				'RRULE:FREQ=' + event.repeat_mode + ';WKST=MO;INTERVAL=' + interval +
				';COUNT=' + ((last_range - first_range + 1) / interval),

				'DTSTAMP:' + remove_date_symbol_z(new Date().toISOString()) + 'Z',

				'UID:' + event.day + ':' +
				`${_2(start_time[0])}.${_2(start_time[1])}-${_2(end_time[0])}.${_2(end_time[1])}` + ':' +
				`${first_range}-${last_range}` + ':' +
				`${encode(event.title)}:${encode(event.note)}:${encode(event.location)}`,

				'END:VEVENT',
			]));
		}
	}

	return ics.join(newline + newline);
});

var newline = '\r\n';

var timetable_start_hours   = (section, timetable) => path([section, 0, 0], timetable);
var timetable_start_minutes = (section, timetable) => path([section, 0, 1], timetable);
var timetable_end_hours     = (section, timetable) => path([section, 1, 0], timetable);
var timetable_end_minutes   = (section, timetable) => path([section, 1, 1], timetable);

var timetable = {
	1: [[08, 00], [08, 45]],
	2: [[08, 55], [09, 40]],
	3: [[10, 00], [10, 45]],
	4: [[10, 55], [11, 40]],

	5: [[14, 30], [15, 15]],
	6: [[15, 25], [16, 10]],
	7: [[16, 20], [17, 05]],
	8: [[17, 15], [18, 00]],

	9: [[19, 30], [20, 15]],
	10: [[20, 25], [21, 10]],
	11: [[21, 20], [22, 05]],
	12: [[22, 15], [23, 00]],

	24: [[00, 00], [24, 00]],
};

function parse_course_name(desc) {
	return prop(0, desc.split(newline));
}

function parse_course_teacher(desc) {
	return prop(1, desc.split(newline));
}

function parse_course_weeks_text(desc) {
	return prop(1, desc.match(/(\d+(?:[^\S\r\n]*[^\d\s][^\S\r\n]*\d+)*)[^\d\r\n周]*周/));
}

function parse_course_sections_text(desc) {
	return prop(1, desc.match(/(\d+(?:[^\S\r\n]*[^\d\s][^\S\r\n]*\d+)*)[^\d\r\n节]*节/));
}

function parse_course_range(fn_parse_range_text, desc) {
	let range_text = fn_parse_range_text(desc);
	if (nullp(range_text))
		return [];

	let range = range_text.split(/\s*[,，]\s*/);
	return map(ifelse(match('-'),
					  compose(map(Number), split(/\s*-\s*/)),
					  Number),
			   range);
}

function parse_course_location(desc) {
	return prop(3, desc.split(newline));
}

function parse_course_day(desc) {
	var week_num = {
		'一': 1,
		'二': 2,
		'三': 3,
		'四': 4,
		'五': 5,
		'六': 6,
		'日': 7,
		'天': 7,
	};
	let week = prop(1, desc.match(/(?:周|星期)([一二三四五六日天])/));

	return week_num[week];
}

function parse_course(desc) {
	let times = parse_course_range(parse_course_sections_text, desc);
	if (intervalp(times))
		times = [[head(times), last(times)]];
	else
		times = map(t => [t, t], times);
	times = map(tt => [timetable[tt[0]][0], timetable[tt[1]][1]], times);

	let repeat_ranges = parse_course_range(parse_course_weeks_text, desc);
	if (intervalp(repeat_ranges))
		repeat_ranges = [[head(repeat_ranges), last(repeat_ranges)]];
	else
		repeat_ranges = map(r => typeof r === 'number' ? [r, r] : r, repeat_ranges);

	return new Event(parse_course_day(desc),
					 times,
					 parse_course_name(desc),
					 parse_course_teacher(desc),
					 parse_course_location(desc),
					 repeat_ranges,
					 intervalp(repeat_ranges) || 1,
					 REPEAT_MODE.WEEKLY,
	);
}

var nbsp_to_space = replace(/&nbsp;/g, ' ');
var br_tag_to_newline = replace(/<br[^>]*>/g, newline);
var remove_not_table_tag = replace(/<(?!t|\/t)[^>]+>/g, '');
var remove_hidden_tag = replace(/<(\w+)[^>]+display\s*:\s*none[^>]+>[^<]+((?!<\/\1>)<[^<]+)+<\/\1>/g, '');
var remove_tag = replace(/<[^>]+>/g, '');
var split_by_table_row = split(/<tr[^>]*>/);
var split_by_table_col = split(/<t[hd][^>]*>/);
var split_by_hyphen = split(/\s*-{3,}\s*/);

var remove_interference = compose(remove_not_table_tag,
								  br_tag_to_newline,
								  nbsp_to_space);

var remove_space = replace(/^\s+|[^\S\r\n]+|\s+$/g, '');

var merge_head_to_tail = map((row) =>
							 map((items) =>
								 map((item) => (item + newline + head(head(row))).trim(),
									 items),
								 tail(row)));

var split_table_to_array = compose(map(slice(-8, Infinity)),
								   filter((lst) => lst.length >= 7),
								   map(split_by_table_col),
								   split_by_table_row);

var filter_useless = map(map(compose(split_by_hyphen,
									 remove_space,
									 nbsp_to_space,
									 remove_tag,
									 remove_hidden_tag,
									 br_tag_to_newline)));

var construct_necessary_info = compose(merge_head_to_tail,
									   zip,
									   merge_head_to_tail);

var parse_courses = compose(filter(compose(not, nullp,
										   prop('repeat_ranges'))),
							map(parse_course));

var generate_courses = map(map(parse_courses));

var build_course_table = compose(generate_courses,
								 construct_necessary_info,
								 filter_useless,
								 split_table_to_array);

var generate_ics = function (courses, date) {
	return join(newline, [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-TIMEZONE:Asia/Shanghai',
		'BEGIN:VTIMEZONE',
		'TZID:Asia/Shanghai',
		'X-LIC-LOCATION:Asia/Shanghai',
		'BEGIN:STANDARD',
		'TZOFFSETFROM:+0800',
		'TZOFFSETTO:+0800',
		'TZNAME:CST',
		'DTSTART:19700101T000000',
		'END:STANDARD',
		'END:VTIMEZONE',
		,
		join(newline + newline, map(to_iCalendar(date), courses)),
		,
		'END:VCALENDAR',
	]);
};

var save_ics = function (courses, date) {
	save_file(generate_ics(courses, date), 'text/calendar', 'Courses.ics');
};

var find_table_in_doc = () =>
	compose(join(newline),
			match(/<table[^<]+((?!<\/table>)<[^<]+)+<\/table>/g)
	)(document.body.innerHTML);

var run = (generate_week_tips = false) => {
	let table = find_table_in_doc();
	let course_table = build_course_table(table);
	let courses = flat(flat(course_table));
	let start_date = '2019-02-25';
	let week_tips = [];

	if (generate_week_tips) {
		let max_week_num = Math.max.apply(null, flat(flat(courses.map(course => course.repeat_ranges))));

		for (let i = 0; i < max_week_num; i++) {
			week_tips.push(new Event(1, [timetable[24]],
									 `第 ${i + 1} 周`, '', '',
									 [[1 + i * 7, 7 + i * 7]], 1, REPEAT_MODE.DAILY));
		}
	}

	courses = courses.concat(week_tips);
	save_ics(courses, start_date);
}
