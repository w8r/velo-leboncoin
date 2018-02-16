const cheerio = require('cheerio');
const request = require('request');
const sleep = require('system-sleep');

const PREFIX = 'https://www.leboncoin.fr/';
const PARAMETERS = require('./parameters.json');

function convertRequestToUrl(request) {
	let url = PREFIX;

	if(request.category)
		url += checkCategory(request.category) + '/';
	else
		url += 'annonces/';

	if(request.type)
		url += checkType(request.type) + '/';
	else
		url += PARAMETERS.types[0];

	if(request.region_or_department)
		url += checkRegionOrDepartment(request.region_or_department) + '/';

	url += '?';

	if(request.sellers)
		url += checkSellers(request.sellers) + '&';

	if(request.query)
		url += checkQuery(request.query) + '&';

	if(request.sort)
		url += checkSort(request.sort) + '&';

	if(request.titles_only)
		url += checkTitlesOnly(request.titles_only) + '&';

	if(request.urgent_only)
		url += checkUrgentOnly(request.urgent_only) + '&';

	if(request.city_or_postal_code)
		url += checkCityOrPostalCode(request.city_or_postal_code) + '&';

	if(request.filters)
		url += checkFilters(request.filters, request.category) + '&';

	return url;
}

function checkId(id) {
	const str = id.toString();
	if(!Number.isInteger(id) || str.length != 10)
		throw 'Invalid id "' + id + '", the "id" parameter must be a 10-digit integer.';
	return id;
}

function checkCategory(category) {
	category = category.toLowerCase();
	if(!PARAMETERS.categories[category] == -1)
		throw 'Invalid category "' + category + '", check out the "parameters.json" file for know all the valid categories.';
	return category;
}

function checkType(type) {
	type = type.toLowerCase();
	if(PARAMETERS.types.indexOf(type) == -1)
		throw 'Invalid type "' + type + '", types accepted : "offres" & "demandes".';
	return type;
}

function checkRegionOrDepartment(regionOrDepartment) {
	regionOrDepartment = regionOrDepartment.toLowerCase();
	if(PARAMETERS.regionOrDepartment[regionOrDepartment])
		return regionOrDepartment;
	for(let region of Object.keys(PARAMETERS.regionOrDepartment))
		if(PARAMETERS.regionOrDepartment[region].indexOf(regionOrDepartment) != -1)
			return region + '/' + regionOrDepartment;
	throw 'Invalid region or department "' + regionOrDepartment + '", check out the "parameters.json" file for know all the possible regions or departments.';
}

function checkSellers(sellers) {
	sellers = sellers.toLowerCase();
	if(sellers == 'tous')
		return 'f=a';
	if(sellers == 'particuliers')
		return 'f=p';
	if(sellers == 'professionnels')
		return 'f=c';
	throw 'Invalid sellers "' + sellers + '", sellers accepted : "particuliers" & "professionnels".';
}

function checkQuery(query) {
	query = query.toLowerCase();
	if(query.length > 100)
		throw 'The query is too long, max length : 100.';
	return 'q=' + query;
}

function checkSort(sort) {
	sort = sort.toLowerCase();
	if(sort == 'date')
		return 'sp=0';
	if(sort == 'prix')
		return 'sp=1';
	throw 'Invalid sort "' + sort + '", sort accepted : "date" & "prix".';
}

function checkTitlesOnly(titlesOnly) {
	if(typeof titlesOnly !== 'boolean')
		throw 'The "titles_only" parameter must be a boolean.';
	return titlesOnly ? 'it=1' : '';
}

function checkUrgentOnly(urgentOnly) {
	if(typeof urgentOnly !== 'boolean')
		throw 'The "urgent_only" parameter must be a boolean.';
	return urgentOnly ? 'ur=1' : '';
}

function checkCityOrPostalCode(cityOrPostalCode) {
	if(typeof cityOrPostalCode !== 'string')
		throw 'The "city_or_postal_code" parameter must be a string.';
	return 'location=' +  cityOrPostalCode.toLowerCase();
}

function checkFilters(filters, category) {
	if(typeof filters !== 'object')
		throw 'The "filters" parameters must be a object.';
	if(!category)
		throw 'A category must be specified for use the "filters" parameter.';
	let str = '';
	let filter;
	let value;
	for(let filterName of Object.keys(filters)) {
		filter = PARAMETERS.categories[category][filterName];
		if(!filter)
			throw 'The filter name "' + filterName + '" is invalid for this category, check out the "parameters.json" file for more information.';

		filters[filterName] = numberWithSpaces(filters[filterName]);
		value = PARAMETERS.categories[category][filterName].values[filters[filterName]];
		if(!value || value === 'undefined')
			throw 'The value "' + filters[filterName] + '" is invalid for the filter "' + filterName + '", check out the "parameters.json" file for more information.';

		str += filter.id + '=' + value + '&';
	}

	return str;
}

function getPhoneNumber(itemId, callback) {
	request.post({
		url: 'https://api.leboncoin.fr/api/utils/phonenumber.json',
		form: {
			list_id: itemId,
			app_id: 'leboncoin_web_utils',
			key: '54bb0281238b45a03f0ee695f73e704f',
			text: 1
		}
	},
	function(error, response, html) {
		if(error)
			callback(null);
		else {
			const json = JSON.parse(response.body);
			callback((!json || !json.utils || !json.utils.phonenumber) ? null : json.utils.phonenumber);
		}
	});
}

function sendSearchRequest(url, data) {
	return new Promise(function(resolve, reject) {
		request(url, function(error, response, html) {
			if(error) {
				reject(error);
				return;
			}

			const $ = cheerio.load(html);
			$('.mainList .list_item').each(function(index, elt) {
				const infos = $(this).find('.item_supp');
				const category = infos.first().text().trim();
				const url = $(this).attr('href');
				const thumbnail = $(this).find('.item_imagePic > span').first().attr('data-imgsrc');
				const mainImage = !thumbnail ? null : {
					thumbnail: thumbnail,
					medium: thumbnail.replace('ad-thumb', 'ad-image'),
					large: thumbnail.replace('ad-thumb', 'ad-large')
				}
				data.push({
					id: url.match(/[0-9]{9,10}/)[0],
					title: $(this).find('.item_title').text().trim(),
					url: 'https:' + url,
					category: category ? category : null,
					location: infos.eq(1).text().replace(/(?:\r\n|\r|\n|  )/g, '').trim(),
					price: Number($(this).find('.item_price').text().replace(/€| /g, '').trim()),
					date: $(this).find('aside.item_absolute').text().replace('Urgent', '').trim(),
					main_image: mainImage,
					number_of_images: Number($(this).find('.item_imageNumber').text()),
					urgent: !!$(this).find('.emergency').length,
					booster: !!$('.icon-booster').length,
					is_pro: !!$(this).find('.ispro').length
				});
			});

			resolve();
		});
	});
}

function sendItemRequest(url) {
	return new Promise(function(resolve, reject) {
		request(url, function(error, response, html) {
			if(error) {
				reject(error);
				return;
			}

			const $ = cheerio.load(html);
			const title = $('h1').text().trim();
			if(title == 'Cette annonce est désactivée')
				return resolve({});

			const id =  url.match(/[0-9]{10}/)[0];
			const sellerInfo = $('.line_pro');
			const thumbnails = $('script').eq(12).html().match(/https:\/\/img[0-9]\.leboncoin\.fr\/ad-thumb.+\.jpg/g);
			const images = [];
			thumbnails.forEach(function(thumbnail) {
				images.push({
					thumbnail: thumbnail,
					medium: thumbnail.replace('ad-thumb', 'ad-image'),
					large: thumbnail.replace('ad-thumb', 'ad-large')
				});
			});

			getPhoneNumber(id, function(phoneNumber) {
				resolve({
					id: id,
					title: title,
					url: url,
					category: $('#main nav li:nth-child(3)').text().trim(),
					location: $('.line_city .value').text().trim(),
					price: Number($('.item_price .value').text().replace(/€| /g, '').trim()),
					date: sellerInfo.first().text().replace('Mise en ligne le', '').trim(),
					number_of_images: Number($('.item_photo').text().replace('photos disponibles', '').trim()),
					images: images,
					seller: $('.mbs > p.title').text().trim(),
					phone_number: phoneNumber,
					contact_seller: 'https:' + sellerInfo.last().find('a').attr('href'),
					description: $('.properties_description .value').text().replace('<br>', '\n').trim(),
					booster: !!$('.icon-booster').length,
					is_pro: !!$('.ad_pro').length
				});
			});
		});
	});
}

function promiseWhile(action, condition) {
	if(condition())
		return action().then(function() {
			return promiseWhile(action, condition);
		});
	else
		return Promise.resolve();
}

function promiseWait(seconds) {
	return new Promise(function(resolve) {
		sleep(seconds * 1000);
		resolve();
	});
}

function numberWithSpaces(number) {
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

module.exports = {
	search: function(req = {}, minPage = 1, maxPage = 1) {
		return new Promise(function(resolve, reject) {
			let url;
			try {
				url = convertRequestToUrl(req);
			}
			catch(e) {
				reject(e);
				return;
			}

			const items = [];
			let page = minPage;
			promiseWhile(function() {
				if (page === 1) {
					url += 'o=1';
				} else {
				  console.log(page, url.replace('o=' + (page - 1), 'o=' + (page)));
				  url = url.replace('o=' + (page - 1), 'o=' + (page));
			  }
			  page++;
				return sendSearchRequest(url, items);
			}, function() {
				return page <= maxPage;
			}).then(function() {
				resolve(items);
			}, reject);
		});
	},

	get: function(id) {
		try {
			return sendItemRequest(PREFIX + 'c/' + checkId(id) + '.htm');
		}
		catch(e) {
			return Promise.reject(e);
		}
	},

	watch: function(req, interval = 60, action) {
		let url;
		try {
			url = convertRequestToUrl(req);
		}
		catch(e) {
			return Promise.reject(e);
		}

		let lastId = null;

		promiseWhile(function() {
			const data = [];
			return sendSearchRequest(url, data).then(function() {
				console.log(new Date().toString() + ' : checking new items...');
				if(data.length) {
					if(lastId) {
						let i = 0;
						while(i < data.length && lastId != data[i].id)
							action(data[i++]);
					}
					lastId = data[0].id;
				}
				return promiseWait(interval);
			});
		}, function() {
			return true;
		});
	}
}
