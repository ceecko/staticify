var send = require("send"),
	path = require("path"),
	crypto = require("crypto"),
	fs = require("fs");

function buildVersionHash(directory, root, versions) {
	// Walks the directory tree, finding files, generating a version hash
	var files = fs.readdirSync(directory);
	root = root || directory;
	versions = versions || {};

	files.forEach(function(file) {
		var filePath = path.join(directory, file),
			stat = fs.statSync(filePath);

		if(stat.isDirectory()) {
			buildVersionHash(filePath, root, versions);		// Whee!
		} else if(stat.isFile()) {
			var hash = crypto.createHash("md5").update(fs.readFileSync(filePath, "utf8"), "utf8").digest("hex");
			versions["/" + path.relative(root, filePath)] = hash;
		}
	});

	return versions;
}

function stripVersion(p) {
	var fileName = path.basename(p);

	var fileNameParts = fileName.split(".");
	if(
		fileNameParts.length >= 3
		&& fileNameParts[fileNameParts.length - 2].length == 32
		&& /^[0-9a-f]{32}$/i.exec(fileNameParts[fileNameParts.length - 2])[0] === fileNameParts[fileNameParts.length - 2]
	) {
		var stripped = fileNameParts.slice(0, fileNameParts.length - 2);
		stripped.push(fileNameParts[fileNameParts.length - 1]);
		return path.join(path.dirname(p), stripped.join("."));
	}

	return p;
}

module.exports = function(root, options) {
	var versions = buildVersionHash(root);
	options = options || {};

	function getVersionedPath(p) {
		if(!versions[p]) return p;

		var fileName = path.basename(p),
			fileNameParts = fileName.split(".");

		fileNameParts.push(versions[p], fileNameParts.pop());

		return path.join(path.dirname(p), fileNameParts.join("."))
	}

	function serve(req, res) {
		var filePath = stripVersion(req.url);

		send(req, filePath)
			.maxage(filePath == req.url ? 0 : 1000 * 60 * 60 * 23 * 365)
			.index(options.index || "index.html")
			.hidden(options.hidden)
			.root(root)
			.pipe(res);
	}

	return {
		_versions: versions,
		getVersionedPath: getVersionedPath,
		stripVersion: stripVersion,
		serve: serve
	}
}
