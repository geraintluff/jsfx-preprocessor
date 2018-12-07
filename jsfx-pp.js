'use strict';
function expandSequences(source) {
	var match;
	var regex = /\{#([^#=]+)=([0-9]+),([0-9]+)\}(([^\{]|\{[^#])*)\{#\}/g;
	while (regex.test(source)) {
		source = source.replace(regex, function (match, name, start, end, body) {
			start = parseInt(start);
			end = parseInt(end);
			body = body.replace(/^[\s\r\n]+/, '');
			var result = '';
			var step = (end > start) ? 1 : -1;
			for (var i = start; true; i += step) {
				result += body.split(name).join(i);
				if (i == end) break;
			}
			return result;
		});
	}
	return source;
}

function functionRefs(source) {
	var functionSwitcherSets = {};
	var declarationRegex = /function\s*\{\s*([a-z0-9_\.]+)\s*\}\s*\(\s*([a-z0-9_\.]+\s*(,\s*[a-z0-9_\.]+\*?\s*)*)?\)/g;

	source = source.replace(declarationRegex, function (match, groupName, args) {
		var argNames = args ? args.split(/,\s*/g) : [];
		argNames = argNames.map(function (name, index) {
			if (/^arg[0-9]+$/.test(name) || name === 'function_id') return 'arg' + index;
			return name;
		});
		functionSwitcherSets[groupName] = {
			counter: 1,
			functions: [],
			map: {},
			argNames: argNames,
		};
		return match;
	});

	source = source.replace(/\{\s*([a-z0-9_\.]+)\s*\}\s*([a-z0-9_\.]+)/ig, function (match, groupName, funcName) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group defined for {' + groupName + '}' + funcName);
		if (!(funcName in group.map)) {
			group.map[funcName] = group.counter++;
			group.functions.push(funcName);
		}
		return group.map[funcName] + '/*' + funcName + '*/';
	});

	source = source.replace(declarationRegex, function (match, groupName, args) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group for: ' + funName);
		var switcherCode = 'function ' + groupName + '(' + ['function_id'].concat(group.argNames).join(', ') + ') (';

		var ids = [0], callCodeMap = {'0': '0'};
		group.functions.forEach(function (func, index) {
			var args = group.argNames.map(function (varName) {
				return varName.replace('*', '');
			});
			var callCode = func + '(' + args.join(', ') + ')';
			var id = group.map[func];
			ids.push(id);
			callCodeMap[id] = callCode;
		});
		ids.sort();

		function indent(code) {
			return '\n\t' + code.trim().replace(/\n/g, '\n\t');
		}

		function handleList(ids, low, high) {
			if (low >= high) return '0';
			if (low + 1== high) {
				return callCodeMap[ids[low]];
			}
			var mid = Math.ceil((low + high)/2);
			return '(function_id < ' + mid + ' ?' + indent(handleList(ids, low, mid)) + indent(' : ' + handleList(ids, mid, high)) + '\n)';
		}
		switcherCode += indent(handleList(ids, 0, ids.length));
		switcherCode += ';\n);'
		return switcherCode;
	});

	source = source.replace(/\{\s*([a-z0-9_\.]+)\s*\:([^}]*)\}\s*\(\s*([^)]*)/g, function (match, groupName, expr, untilCloseBrackets) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group defined for {' + groupName + ':' + expr + '}');
		return groupName + '(' + expr + (untilCloseBrackets ? ', ' + untilCloseBrackets : ')');
	});

	return source;
};

function autoEnums(source) {
	var groups = {};
	function getGroup(key) {
		return groups[key] = groups[key] || {
			counter: 0,
			countingRefs: 0,
			values: [],
			map: {},
			fixedVars: {}
		};
	}
	source = source.replace(/([a-z0-9\-\_\.]+)#([a-z0-9\-\_\.]+)\(([0-9]+)\)/gi, function (match, key, suffix, forceNumber) {
		var group = getGroup(key);
		var n = parseFloat(forceNumber);
		if (isNaN(n)) throw new Error('Invalid enum forcing: ' + match);
		group.counter = Math.max(n + 1, group.counter);
		if ((n in group.fixedVars) && group.fixedVars[n] !== suffix) {
			throw new Error('Conflicting enum forcing for ' + n + ' in ' + key + ': ' + suffix + ' and ' + group.fixedVars[n]);
		}
		if (suffix in group.map && parseFloat(group.map[suffix]) !== n) {
			throw new Error('Conflicting enum forcing for ' + suffix + ': ' + parseFloat(group.map[suffix]) + ' and ' + n);
		}
		group.fixedVars[n] = suffix;
		group.map[suffix] = n + '/*' + key + ':' + suffix + '*/';
		return key + '#' + suffix;
	});
	source = source.replace(/([a-z0-9\-\_\.]+)#([a-z0-9\-\_\.]+)/gi, function (match, key, suffix) {
		var group = getGroup(key);
		if (suffix in group.map) {
			return group.map[suffix];
		} else {
			group.values.push(suffix);
			return group.map[suffix] = (group.counter++) + '/*' + key + ':' + suffix + '*/';
		}
	});
	source = source.replace(/([a-z0-9\-\_\.]+)#(#?)/gi, function (match, key, forceOnlyCount) {
		var group = getGroup(key);
		if (!group.counter) throw new Error('Reference to undefined group: ' + match);
		group.countingRefs++;
		if (forceOnlyCount && group.countingRefs != 1) {
			throw new Error('Group counted more than once: ' + match);
		}
		if (group.countingRefs == 1) {
			return group.counter + '/*' + key + ': ' + group.values.join(', ') + '*/';
		} else {
			return group.counter + '/*' + key + '*/';
		}
	});
	for (var key in groups) {
		var group = groups[key];
		if (!group.countingRefs) {
			console.error("Warning: group " + key + ' is not counted');
		}
	}
	return source;
}

<<<<<<< HEAD
if (typeof module === 'object') {
	module.exports = function (source) {
		var packageJson = require('./package.json');
		return '/* Generated by: ' + (packageJson.website || 'JSFX Pre-Processor') + ' */\n' + functionRefs(autoEnums(expandSequences(source)));
	};

=======
function JsfxPP(source) {
	var packageJson = require('./package.json');
	return '/* Generated by: ' + (packageJson.website || 'JSFX Pre-Processor') + ' */\n' + functionRefs(autoEnums(expandSequences(source)));
};

if (typeof module === 'object') {
	module.exports = JsfxPP;

>>>>>>> master
	if (require.main == module) {
		var inputFile = process.argv[2], outputFile = process.argv[3];
		if (!inputFile || !outputFile) {
			console.error('Usage: jsfx-preprocessor [input-file] [output-file]');
			process.exit(1);
		}
		var source = require('fs').readFileSync(inputFile, {encoding: 'utf-8'});
		require('fs').writeFileSync(outputFile, module.exports(source));
	}
}
