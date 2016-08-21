'use strict';

class JsonSerializable{
	constructor() {
		this._identifier = SimpleEdit.identifier;
	}

	toJson(){
		let data = {};

		for(let key in this)
			if(this.hasOwnProperty(key) && key !== '_identifier')
				data[key] = this[key];

		return JSON.stringify(data);
	}

	fromJson(data){
		data = JSON.parse(data);

		for(let key in data)
			if(data.hasOwnProperty(key) && key !== '_identifier')
				this[key] = data[key];	

		return this;
	}
}

class SimpleEdit {
	constructor(){
		this.groups = [];
		this.markdownIt = window.markdownit({
			html: true,
			xhtmlOut: true,
			linkify: true,
			typographer: true
		});

		this.markdownIt.use(window.markdownitEmoji);

		this.load();
		this.save();

		this._addEventListeners();
		this.updateFileTree();
		this.updatePreview();
		this.updateCheatSheet();
	}

	static get identifier() {
		if (!SimpleEdit._identifier)
			SimpleEdit._identifier = 100000;
		
		return SimpleEdit._identifier++;
	}

	_action(action, data){
		switch(action){
			case 'toggle-column':
				let column = $(`.column[data-column="${data.column}"]`);
				let toggle = $(`[data-action="toggle-column"][data-column="${data.column}"]`);

				if (column.hasClass('hide')) {
					column.removeClass('hide');
					toggle.removeClass('is-active');
				} else {
					column.addClass('hide');
					toggle.addClass('is-active');
				}

				break;

			case 'group-create':
				this.createGroup().edit();
				break;

			case 'pdf':
				// Rewrite this
				if(!confirm('Generate PDF?'))
					return;

				let token = window.localStorage.getItem('x-token') || null;

				if (token === null)
					token = prompt('X-Token');
				
				window.localStorage.setItem('x-token', token);

				var headers = new Headers();
				headers.append('X-Token', token);
				headers.append('X-Type', 'markdown');

				fetch('https://api.paperbark.io/pdf', {
					method: 'POST',
					headers: headers,
					body: $('#editor textarea').val()
				}).then(function (response) {
					if (!response.ok)
						throw new Error('document failed to load');
					
					return response.blob();
				}).then(function (blob) {
						return URL.createObjectURL(blob);
				}).then(function (url) {
					let a = document.createElement('a');
					a.href = url;
					a.download = 'download.pdf';
					a.click();
				}).catch(function () {
					simpleEdit.error('Error while genrating PDF.');
				});

				break;

			default:
				console.log('Unknown action ' + action, data);
		}
	}

	_addEventListeners() {
		var simpleEdit = this;
		$(document).on('click', '[data-action]', function(){
			let action = $(this).attr('data-action');
			let data = $(this).get(0).dataset;

			simpleEdit._action(action, data);
		});

		$(document).on('change keyup', '#editor textarea', () => this.updatePreview());
		$(window).on('unload', () => this.save());
	}
	
	load() {
		// Load groups & files
		let groups = JSON.parse(window.localStorage.getItem('groups')) || [];
		groups.forEach((group) => this.groups.push(new SimpleEditGroup().fromJson(group)));

		// Load columns
		let columns = JSON.parse(window.localStorage.getItem('columns')) || [];
		columns.forEach((column) => {
			let element = $(`.column[data-column="${column.column}"]`);
			let toggle = $(`[data-action="toggle-column"][data-column="${column.column}"]`);

			if (column.hidden) {
				element.addClass('hide');
				toggle.addClass('is-active');
			} else {
				element.removeClass('hide');
				toggle.removeClass('is-active');
			}
		});
	}

	save() {
		// Save groups & files
		let groups = [];
		this.groups.forEach((group) => groups.push(group.toJson()));
		window.localStorage.setItem('groups', JSON.stringify(groups));

		// Save columns
		let columns = [];
		$('[data-column]').each(function () {
			columns.push({
				column: $(this).attr('data-column'),
				hidden: $(this).hasClass('hide')
			});
		});
		window.localStorage.setItem('columns', JSON.stringify(columns));
	}

	createGroup(name, files){
		let group = new SimpleEditGroup(name, files);
		this.groups.push(group);
		this.updateFileTree();

		return group;
	}

	error(msg){
		$('#container').prepend('<div class="error">' + (typeof msg === 'string' ? msg : JSON.stringify(msg)) + '</div>');
	}

	updatePreview() {
		let markdown = $('#editor textarea').val();
		let html = this.markdownIt.render(markdown);

		if (markdown.length === 0 || html.length === 0)
			html = '<div class="warning center">A preview of the markdown document will apear here.</div>';	

		$('#preview').html(html);
	}

	updateFileTree() {
		let html = '';

		if (this.groups.length === 0) {
			html = '<div class="warning">No files yet</div>';
		}else{			
			this.groups.forEach((group, index) => {
				let id = index;

				let body = '';

				if (group.files.length === 0) {
					body = '<a>No files yet</a>';
				} else {
					group.files.forEach((file, index) => {
						body += `<a href="#" id="file-${file._identifier}">${file.name}</a>`;
					});
				}

				html +=
					`<div class="group" id="group-${group._identifier}">
						<input type="checkbox" id="group-toggle-${group._identifier}" />
						<label for="group-toggle-${group._identifier}" class="header">
							${group.name}
						</label>
						<div class="body">
							${body}
						</div>
					</div>`;
			});
		}

		$('#file-tree').html(html);
	}

	updateCheatSheet() {
		$.get('assets/cheatsheet.md', (markdown) => {
			$('#cheatsheet').html(this.markdownIt.render(markdown));
		})
	}
}

class SimpleEditGroup extends JsonSerializable {
	constructor(name, files){
		super();

		this._name = name || 'New group';
		this._files = files || [];
	}

	get name(){
		return this._name;
	}

	set name(value){
		this._name = value;
	}

	get files(){
		return this._files;
	}

	createFile(){
		return this.files.push(new SimpleEditFile()) - 1;
	}
}

class SimpleEditFile extends JsonSerializable {
	constructor(name, content){
		super();
		
		this._name = name || 'New file';
		this._content = content || '';
	}

	get name(){
		return this._name;
	}

	set name(value){
		this._name = value;
	}

	get content(){
		return this._content;
	}

	set content(value){
		this._content = value;
	}
}

$(document).ready(function () {
	window.simpleEdit = new SimpleEdit();
});

// old prototype
$(document).ready(function(){
	var md = window.markdownit({
		html: true,
		xhtmlOut: true,
		linkify: true,
		typographer: true
	});

	md.use(window.markdownitEmoji);

	$('body').on('click', '#preview a', function(){
		event.preventDefault();
		window.open($(this).attr('href'));
	});
});

function error(msg){
	$('#container').prepend('<div class="error">' + msg + '</div>');
}