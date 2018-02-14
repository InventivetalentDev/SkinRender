"use strict";
(function (window) {

    var defaultOptions = {
        showAxes: false,
        showGrid: false,
        autoResize: false,
        controls: {
            enabled: true,
            zoom: true,
            rotate: true,
            pan: true
        },
        camera: {
            x: 20,
            y: 35,
            z: 20
        },
        canvas: {
            width: undefined,
            height: undefined
        }
    };

    function SkinRender(options, element) {
        console.log(element);
        console.log(options);

        this.element = element;
        this._element = element || window.document.body;
        this._animId = -1;

        this.options = Object.assign({}, defaultOptions, options);
        if (!THREE.OrbitControls) {
            console.warn("OrbitControls not found. Disabling skin controls.");
            this.options.controls.enabled = false;
        }

        // bind this renderer to the element
        this._element.skinRender = this;
    }

    SkinRender.prototype.render = function (texture, cb) {
        var skinRender = this;

        var renderStarted = false;

        function imagesLoaded(skinTexture, capeTexture) {
            renderStarted = true;
            skinTexture.needsUpdate = true;
            if (capeTexture) capeTexture.needsUpdate = true;

            var textureVersion = -1;
            if (skinTexture.image.height === 32) {
                textureVersion = 0;
            } else if (skinTexture.image.height === 64) {
                textureVersion = 1;
            } else {
                console.error("Couldn't detect texture version. Invalid dimensions: " + skinTexture.image.width + "x" + skinTexture.image.height)
            }
            console.log("Skin Texture Version: " + textureVersion)

            // To keep the pixelated texture
            skinTexture.magFilter = THREE.NearestFilter;
            skinTexture.minFilter = THREE.NearestFilter;
            skinTexture.anisotropy = 0;
            if (capeTexture) {
                capeTexture.magFilter = THREE.NearestFilter;
                capeTexture.minFilter = THREE.NearestFilter;
                capeTexture.anisotropy = 0;
            }

            var scene = new THREE.Scene();
            skinRender._scene = scene;
            var camera = new THREE.PerspectiveCamera(75, (skinRender.options.canvas.width || window.innerWidth) / (skinRender.options.canvas.height || window.innerHeight), 0.1, 1000);

            // scene.background = new THREE.Color( 0xff0000 );

            var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
            renderer.setSize((skinRender.options.canvas.width || window.innerWidth), (skinRender.options.canvas.height || window.innerHeight));
            renderer.setClearColor(0x000000, 0);
            skinRender._element.appendChild(skinRender._canvas = renderer.domElement);

            if (skinRender.options.controls.enabled) {
                var controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableZoom = skinRender.options.controls.zoom;
                controls.enableRotate = skinRender.options.controls.rotate;
                controls.enablePan = skinRender.options.controls.pan;
                controls.target.set(0, 18, 0)
            }
            if (skinRender.options.autoResize) {
                window.addEventListener("resize", function () {
                    var width = skinRender.element ? skinRender.element.offsetWidth : window.innerWidth;
                    var height = skinRender.element ? skinRender.element.offsetHeight : window.innerHeight;

                    skinRender._resize(width, height);
                }, false)
            }
            skinRender._resize = function (width, height) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();

                renderer.setSize(width, height);
            };

            if (skinRender.options.showAxes) {
                scene.add(buildAxes(100));
            }
            if (skinRender.options.showGrid) {
                scene.add(new THREE.GridHelper(100, 100));
            }

            console.log("Slim: " + slim)
            var playerModel = createPlayerModel(skinTexture, capeTexture, textureVersion, slim);
            scene.add(playerModel);
            console.log(playerModel);
            skinRender.playerModel = playerModel;

            camera.position.x = skinRender.options.camera.x;
            camera.position.y = skinRender.options.camera.y;
            camera.position.z = skinRender.options.camera.z;
            camera.lookAt(new THREE.Vector3(0, 18, 0))

            var animate = function () {
                skinRender._animId = requestAnimationFrame(animate);

                skinRender.getElement().dispatchEvent(new CustomEvent("skinRender", {detail: {playerModel: playerModel}}));

                renderer.render(scene, camera);
            };

            animate();

            if (typeof cb === "function") cb();
        }

        skinRender._skinImage = new Image();
        skinRender._skinImage.crossOrigin = "anonymous";
        skinRender._capeImage = new Image();
        skinRender._capeImage.crossOrigin = "anonymous";
        var hasCape = texture.capeUrl !== undefined || texture.capeData !== undefined || texture.mineskin !== undefined;
        var slim = false;
        var skinLoaded = false;
        var capeLoaded = false;

        var skinTexture = new THREE.Texture();
        var capeTexture = new THREE.Texture();
        skinTexture.image = skinRender._skinImage;
        skinRender._skinImage.onload = function () {
            if (!skinRender._skinImage) return;

            skinLoaded = true;
            console.log("Skin Image Loaded");

            if (texture.slim === undefined) {
                var detectCanvas = document.createElement("canvas");
                var detectCtx = detectCanvas.getContext("2d");
                // detectCanvas.style.display = "none";
                detectCanvas.width = skinRender._skinImage.width;
                detectCanvas.height = skinRender._skinImage.height;
                detectCtx.drawImage(skinRender._skinImage, 0, 0);

                console.log("Slim Detection:")

                // Check the 2 columns that should be transparent on slim skins
                var px1 = detectCtx.getImageData(46, 52, 1, 12).data;
                var px2 = detectCtx.getImageData(54, 20, 1, 12).data;
                var allTransparent = true;
                for (var i = 3; i < 12 * 4; i += 4) {
                    if (px1[i] === 255) {
                        allTransparent = false;
                        break;
                    }
                    if (px2[i] === 255) {
                        allTransparent = false;
                        break;
                    }
                }
                console.log(allTransparent)

                if (allTransparent) slim = true;
            }

            if (skinLoaded && (capeLoaded || !hasCape)) {
                if (!renderStarted) imagesLoaded(skinTexture, capeTexture);
            }
        };
        skinRender._skinImage.onerror = function (e) {
            console.warn("Skin Image Error")
            console.warn(e)
        }
        console.log("Has Cape: " + hasCape)
        if (hasCape) {
            capeTexture.image = skinRender._capeImage;
            skinRender._capeImage.onload = function () {
                if (!skinRender._capeImage) return;

                capeLoaded = true;
                console.log("Cape Image Loaded");

                if (capeLoaded && skinLoaded) {
                    if (!renderStarted) imagesLoaded(skinTexture, capeTexture);
                }
            }
            skinRender._capeImage.onerror = function (e) {
                console.warn("Cape Image Error")
                console.warn(e);

                // Continue anyway, just without the cape
                if (skinLoaded) {
                    if (!renderStarted) imagesLoaded(skinTexture);
                }
            }
        } else {
            capeTexture = null;
            skinRender._capeImage = null;
        }

        if (typeof texture === "string") {
            if (texture.indexOf("http") === 0) {// URL
                skinRender._skinImage.src = texture
            } else if (texture.length <= 16) {// Probably a Minecraft username
                getJSON("https://skinrender.ga/nameToUuid.php?name=" + texture, function (err, data) {
                    if (err) return console.log(err);
                    skinRender._skinImage.src = "https://crafatar.com/skins/" + data.id ? data.id : texture;
                });
            } else if (texture.length <= 36) {// Probably player UUID
                image.src = "https://crafatar.com/skins/" + texture;
            } else {// taking a guess that it's a Base64 image
                skinRender._skinImage.src = texture;
            }
        } else if (typeof texture === "object") {
            if (texture.url) {
                skinRender._skinImage.src = texture.url;
            } else if (texture.data) {
                skinRender._skinImage.src = texture.data;
            } else if (texture.username) {
                getJSON("https://skinrender.ga/nameToUuid.php?name=" + texture.username, function (err, data) {
                    if (err) return console.log(err);
                    skinRender._skinImage.src = "https://crafatar.com/skins/" + data.id ? data.id : texture.username;
                });
            } else if (texture.uuid) {
                skinRender._skinImage.src = "https://crafatar.com/skins/" + texture.uuid;
            } else if (texture.mineskin) {
                skinRender._skinImage.src = "https://api.mineskin.org/render/texture/" + texture.mineskin;
            }
            if (texture.capeUrl) {
                skinRender._capeImage.src = texture.capeUrl;
            } else if (texture.capeData) {
                skinRender._capeImage.src = texture.capeData;
            } else if (texture.mineskin) {
                skinRender._capeImage.src = "https://api.mineskin.org/render/texture/" + texture.mineskin + "/cape";
            }

            slim = texture.slim;
        } else {
            throw new Error("Invalid texture value")
        }
    };

    SkinRender.prototype.resize = function (width, height) {
        return this._resize(width, height);
    };

    SkinRender.prototype.reset = function () {
        this._skinImage = null;
        this._capeImage = null;

        if (this._animId) {
            cancelAnimationFrame(this._animId);
        }
        if (this._canvas) {
            this._canvas.remove();
        }
    };

    SkinRender.prototype.getElement = function () {
        return this._element;
    };

    SkinRender.prototype.getPlayerModel = function () {
        return this.playerModel;
    };


    SkinRender.prototype.getModelByName = function (name) {
        return this._scene.getObjectByName(name, true);
    };

    SkinRender.prototype.toggleSkinPart = function (name, visible) {
        this._scene.getObjectByName(name, true).visible = visible;
    };


    var createCube = function (texture, width, height, depth, textures, slim, name, transparent) {
        var textureWidth = texture.image.width;
        var textureHeight = texture.image.height;

        var geometry = new THREE.BoxGeometry(width, height, depth);
        var material = new THREE.MeshBasicMaterial({
            /*color: 0x00ff00,*/map: texture, transparent: transparent, side: transparent ? THREE.DoubleSide : THREE.FrontSide//TODO: double sided not working properly
        });

        geometry.computeBoundingBox();

        geometry.faceVertexUvs[0] = [];

        var faceNames = ["right", "left", "top", "bottom", "front", "back"];
        var faceUvs = [];
        for (var i = 0; i < faceNames.length; i++) {
            var face = textures[faceNames[i]];
            if (faceNames[i] === "back") {
                //     console.log(face)
                console.log("X: " + (slim && face.sx ? face.sx : face.x))
                console.log("W: " + (slim && face.sw ? face.sw : face.w))
            }
            var w = textureWidth;
            var h = textureHeight;
            var tx1 = ((slim && face.sx ? face.sx : face.x) / w);
            var ty1 = (face.y / h);
            var tx2 = (((slim && face.sx ? face.sx : face.x) + (slim && face.sw ? face.sw : face.w)) / w);
            var ty2 = ((face.y + face.h) / h);

            faceUvs[i] = [
                new THREE.Vector2(tx1, ty2),
                new THREE.Vector2(tx1, ty1),
                new THREE.Vector2(tx2, ty1),
                new THREE.Vector2(tx2, ty2)
            ];
            // console.log(faceUvs[i])

            var flipX = face.flipX;
            var flipY = face.flipY;

            var temp;
            if (flipY) {
                temp = faceUvs[i].slice(0);
                faceUvs[i][0] = temp[2];
                faceUvs[i][1] = temp[3];
                faceUvs[i][2] = temp[0];
                faceUvs[i][3] = temp[1]
            }
            if (flipX) {//flip x
                temp = faceUvs[i].slice(0);
                faceUvs[i][0] = temp[3];
                faceUvs[i][1] = temp[2];
                faceUvs[i][2] = temp[1];
                faceUvs[i][3] = temp[0]
            }
        }

        var j = 0;
        for (var i = 0; i < faceUvs.length; i++) {
            geometry.faceVertexUvs[0][j] = [faceUvs[i][0], faceUvs[i][1], faceUvs[i][3]];
            geometry.faceVertexUvs[0][j + 1] = [faceUvs[i][1], faceUvs[i][2], faceUvs[i][3]];
            j += 2;
        }
        geometry.uvsNeedUpdate = true;

        var cube = new THREE.Mesh(geometry, material);
        cube.name = name;
        // cube.position.set(x, y, z);
        cube.castShadow = true;
        cube.receiveShadow = false;

        return cube;
    };

    var createPlayerModel = function (skinTexture, capeTexture, v, slim) {
        var headGroup = new THREE.Object3D();
        headGroup.position.x = 0;
        headGroup.position.y = 28;
        headGroup.position.z = 0;
        headGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
        var head = createCube(skinTexture,
            8, 8, 8,
            texturePositions.head[v],
            slim,
            "head"
        );
        head.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
        headGroup.add(head);
        if (v >= 1) {
            var hat = createCube(skinTexture,
                8.504, 8.504, 8.504,
                texturePositions.hat,
                slim,
                "hat",
                true
            );
            hat.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
            headGroup.add(hat);
        }

        var bodyGroup = new THREE.Object3D();
        bodyGroup.position.x = 0;
        bodyGroup.position.y = 18;
        bodyGroup.position.z = 0;
        var body = createCube(skinTexture,
            8, 12, 4,
            texturePositions.body[v],
            slim,
            "body"
        );
        bodyGroup.add(body);
        if (v >= 1) {
            var jacket = createCube(skinTexture,
                8.504, 12.504, 4.504,
                texturePositions.jacket,
                slim,
                "jacket",
                true
            );
            bodyGroup.add(jacket);
        }

        var leftArmGroup = new THREE.Object3D();
        leftArmGroup.position.x = slim ? -5.5 : -6;
        leftArmGroup.position.y = 18;
        leftArmGroup.position.z = 0;
        leftArmGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
        var leftArm = createCube(skinTexture,
            slim ? 3 : 4, 12, 4,
            texturePositions.leftArm[v],
            slim,
            "leftArm"
        );
        leftArm.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
        leftArmGroup.add(leftArm);
        if (v >= 1) {
            var leftSleeve = createCube(skinTexture,
                slim ? 3.504 : 4.504, 12.504, 4.504,
                texturePositions.leftSleeve,
                slim,
                "leftSleeve",
                true
            );
            leftSleeve.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
            leftArmGroup.add(leftSleeve);
        }

        var rightArmGroup = new THREE.Object3D();
        rightArmGroup.position.x = slim ? 5.5 : 6;
        rightArmGroup.position.y = 18;
        rightArmGroup.position.z = 0;
        rightArmGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
        var rightArm = createCube(skinTexture,
            slim ? 3 : 4, 12, 4,
            texturePositions.rightArm[v],
            slim,
            "rightArm"
        );
        rightArm.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
        rightArmGroup.add(rightArm);
        if (v >= 1) {
            var rightSleeve = createCube(skinTexture,
                slim ? 3.504 : 4.504, 12.504, 4.504,
                texturePositions.rightSleeve,
                slim,
                "rightSleeve",
                true
            );
            rightSleeve.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
            rightArmGroup.add(rightSleeve);
        }

        var leftLegGroup = new THREE.Object3D();
        leftLegGroup.position.x = -2;
        leftLegGroup.position.y = 6;
        leftLegGroup.position.z = 0;
        leftLegGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
        var leftLeg = createCube(skinTexture,
            4, 12, 4,
            texturePositions.leftLeg[v],
            slim,
            "leftLeg"
        );
        leftLeg.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
        leftLegGroup.add(leftLeg);
        if (v >= 1) {
            var leftTrousers = createCube(skinTexture,
                4.504, 12.504, 4.504,
                texturePositions.leftTrousers,
                slim,
                "leftTrousers",
                true
            );
            leftTrousers.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
            leftLegGroup.add(leftTrousers);
        }

        var rightLegGroup = new THREE.Object3D();
        rightLegGroup.position.x = 2;
        rightLegGroup.position.y = 6;
        rightLegGroup.position.z = 0;
        rightLegGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), 4);
        var rightLeg = createCube(skinTexture,
            4, 12, 4,
            texturePositions.rightLeg[v],
            slim,
            "rightLeg"
        );
        rightLeg.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
        rightLegGroup.add(rightLeg);
        if (v >= 1) {
            var rightTrousers = createCube(skinTexture,
                4.504, 12.504, 4.504,
                texturePositions.rightTrousers,
                slim,
                "rightTrousers",
                true
            );
            rightTrousers.translateOnAxis(new THREE.Vector3(0, 1, 0), -4);
            rightLegGroup.add(rightTrousers);
        }

        var playerGroup = new THREE.Object3D();
        playerGroup.add(headGroup);
        playerGroup.add(bodyGroup);
        playerGroup.add(leftArmGroup);
        playerGroup.add(rightArmGroup);
        playerGroup.add(leftLegGroup);
        playerGroup.add(rightLegGroup);

        if (capeTexture) {
            var capeGroup = new THREE.Object3D();
            capeGroup.position.x = 0;
            capeGroup.position.y = 16;
            capeGroup.position.z = -2.5;
            capeGroup.translateOnAxis(new THREE.Vector3(0, 1, 0), 8);
            capeGroup.translateOnAxis(new THREE.Vector3(0, 0, 1), 0.5);
            var cape = createCube(capeTexture,
                8, 16, 1,
                texturePositions.cape,
                false,
                "cape");
            cape.translateOnAxis(new THREE.Vector3(0, 1, 0), -8);
            cape.translateOnAxis(new THREE.Vector3(0, 0, 1), -0.5);
            cape.rotation.y = toRadians(180);
            capeGroup.add(cape)

            playerGroup.add(capeGroup);
        }

        return playerGroup;
    };

    // From https://soledadpenades.com/articles/three-js-tutorials/drawing-the-coordinate-axes/
    var buildAxes = function (length) {
        var axes = new THREE.Object3D();

        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(length, 0, 0), 0xFF0000, false)); // +X
        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-length, 0, 0), 0xFF0000, true)); // -X
        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, length, 0), 0x00FF00, false)); // +Y
        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -length, 0), 0x00FF00, true)); // -Y
        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, length), 0x0000FF, false)); // +Z
        axes.add(buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -length), 0x0000FF, true)); // -Z

        return axes;

    };
    var buildAxis = function (src, dst, colorHex, dashed) {
        var geom = new THREE.Geometry(),
            mat;

        if (dashed) {
            mat = new THREE.LineDashedMaterial({linewidth: 3, color: colorHex, dashSize: 3, gapSize: 3});
        } else {
            mat = new THREE.LineBasicMaterial({linewidth: 3, color: colorHex});
        }

        geom.vertices.push(src.clone());
        geom.vertices.push(dst.clone());
        geom.computeLineDistances(); // This one is SUPER important, otherwise dashed lines will appear as simple plain lines

        return new THREE.Line(geom, mat, THREE.LinePieces);
    };

    function toRadians(angle) {
        return angle * (Math.PI / 180);
    }

    function getJSON(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'json';
        xhr.onload = function () {
            var status = xhr.status;
            if (status === 200) {
                callback(null, xhr.response);
            } else {
                callback(status, xhr.response);
            }
        };
        xhr.send();
    };


    var texturePositions = {
        head: [
            {// 64x32
                right: {
                    x: 0,
                    y: 16,
                    w: 8,
                    h: 8,
                    flipX: true
                },
                front: {
                    x: 8,
                    y: 16,
                    w: 8,
                    h: 8
                },
                left: {
                    x: 16,
                    y: 16,
                    w: 8,
                    h: 8,
                    flipX: true
                },
                back: {
                    x: 24,
                    y: 16,
                    w: 8,
                    h: 8
                },
                top: {
                    x: 8,
                    y: 24,
                    w: 8,
                    h: 8
                },
                bottom: {
                    x: 16,
                    y: 24,
                    w: 8,
                    h: 8,
                    flipX: true,
                    flipY: true
                }
            },
            {// 64x64
                right: {
                    x: 0,
                    y: 48,
                    w: 8,
                    h: 8,
                    flipX: true
                },
                front: {
                    x: 8,
                    y: 48,
                    w: 8,
                    h: 8
                },
                left: {
                    x: 16,
                    y: 48,
                    w: 8,
                    h: 8,
                    flipX: true
                },
                back: {
                    x: 24,
                    y: 48,
                    w: 8,
                    h: 8
                },
                top: {
                    x: 8,
                    y: 56,
                    w: 8,
                    h: 8
                },
                bottom: {
                    x: 16,
                    y: 56,
                    w: 8,
                    h: 8,
                    flipX: true,
                    flipY: true
                }
            }
        ],
        body: [
            {// 64x32
                right: {
                    x: 16,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 20,
                    y: 0,
                    w: 8,
                    h: 12
                },
                left: {
                    x: 28,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 32,
                    y: 0,
                    w: 8,
                    h: 12
                },
                top: {
                    x: 20,
                    y: 12,
                    w: 8,
                    h: 4
                },
                bottom: {
                    x: 28,
                    y: 12,
                    w: 8,
                    h: 4,
                    flipY: true
                }
            },
            {// 64x64
                right: {
                    x: 16,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 20,
                    y: 32,
                    w: 8,
                    h: 12
                },
                left: {
                    x: 28,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 32,
                    y: 32,
                    w: 8,
                    h: 12
                },
                top: {
                    x: 20,
                    y: 44,
                    w: 8,
                    h: 4
                },
                bottom: {
                    x: 28,
                    y: 44,
                    w: 8,
                    h: 4,
                    flipY: true
                }
            }
        ],
        leftArm: [
            {// 64x32 - same as rightArm
                right: {
                    x: 40,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 44,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                left: {
                    x: 48,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 52,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                top: {
                    x: 44,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 48,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            },
            {// 64x64
                right: {
                    x: 32,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 36,
                    y: 0,
                    w: 4,
                    h: 12,
                    sw: 3,
                    flipX: true
                },
                left: {
                    x: 40,
                    y: 0,
                    w: 4,
                    h: 12,
                    sx: 39,
                    flipX: true
                },
                back: {
                    x: 44,
                    y: 0,
                    w: 4,
                    h: 12,
                    sx: 43,
                    sw: 3,
                    flipX: true
                },
                top: {
                    x: 36,
                    y: 12,
                    w: 4,
                    h: 4,
                    sw: 3,
                    flipX: true
                },
                bottom: {
                    x: 40,
                    y: 12,
                    w: 4,
                    h: 4,
                    sx: 39,
                    sw: 3,
                    flipX: true
                }
            }
        ],
        rightArm: [
            {// 64x32 - same as leftArm
                right: {
                    x: 40,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 44,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                left: {
                    x: 48,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 52,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                top: {
                    x: 44,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 48,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            },
            {// 64x64
                right: {
                    x: 40,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 44,
                    y: 32,
                    w: 4,
                    h: 12,
                    sw: 3,
                    flipX: true
                },
                left: {
                    x: 48,
                    y: 32,
                    w: 4,
                    h: 12,
                    sx: 47,
                    flipX: true
                },
                back: {
                    x: 52,
                    y: 32,
                    w: 4,
                    h: 12,
                    sx: 51,
                    sw: 3,
                    flipX: true
                },
                top: {
                    x: 44,
                    y: 44,
                    w: 4,
                    h: 4,
                    sw: 3,
                    flipX: true
                },
                bottom: {
                    x: 48,
                    y: 44,
                    w: 4,
                    h: 4,
                    sx: 47,
                    sw: 3,
                    flipX: true
                }
            }
        ],
        leftLeg: [
            {// 64x32 - same as rightLeg
                right: {
                    x: 0,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 4,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: false
                },
                left: {
                    x: 8,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 12,
                    y: 0,
                    w: 4,
                    h: 12
                },
                top: {
                    x: 4,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 8,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            },
            {// 64x64
                right: {
                    x: 16,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 20,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                left: {
                    x: 24,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 28,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                top: {
                    x: 20,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 24,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            }
        ],
        rightLeg: [
            {// 64x32 - same as leftLeg
                right: {
                    x: 0,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 4,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                left: {
                    x: 8,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 12,
                    y: 0,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                top: {
                    x: 4,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 8,
                    y: 12,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            },
            {// 64x64
                right: {
                    x: 0,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                front: {
                    x: 4,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                left: {
                    x: 8,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                back: {
                    x: 12,
                    y: 32,
                    w: 4,
                    h: 12,
                    flipX: true
                },
                top: {
                    x: 4,
                    y: 44,
                    w: 4,
                    h: 4,
                    flipX: true
                },
                bottom: {
                    x: 8,
                    y: 44,
                    w: 4,
                    h: 4,
                    flipX: true
                }
            }
        ],

        hat: {
            right: {
                x: 32,
                y: 48,
                w: 8,
                h: 8,
                flipX: true
            },
            front: {
                x: 40,
                y: 48,
                w: 8,
                h: 8
            },
            left: {
                x: 48,
                y: 48,
                w: 8,
                h: 8,
                flipX: true
            },
            back: {
                x: 56,
                y: 48,
                w: 8,
                h: 8
            },
            top: {
                x: 40,
                y: 56,
                w: 8,
                h: 8
            },
            bottom: {
                x: 48,
                y: 56,
                w: 8,
                h: 8,
                flipY: true
            }
        },
        jacket: {
            right: {
                x: 16,
                y: 16,
                w: 4,
                h: 12
            },
            front: {
                x: 20,
                y: 16,
                w: 8,
                h: 12
            },
            left: {
                x: 26,
                y: 16,
                w: 4,
                h: 12
            },
            back: {
                x: 32,
                y: 16,
                w: 8,
                h: 12
            },
            top: {
                x: 20,
                y: 28,
                w: 8,
                h: 4
            },
            bottom: {
                x: 28,
                y: 28,
                w: 8,
                h: 4
            }
        },
        leftSleeve: {
            right: {
                x: 48,
                y: 0,
                w: 4,
                h: 12
            },
            front: {
                x: 52,
                y: 0,
                w: 4,
                h: 12,
                sw: 3
            },
            left: {
                x: 56,
                y: 0,
                w: 4,
                h: 12,
                sx: 55
            },
            back: {
                x: 60,
                y: 0,
                w: 4,
                h: 12,
                sx: 59,
                sw: 3
            },
            top: {
                x: 52,
                y: 12,
                w: 4,
                h: 4,
                sw: 3
            },
            bottom: {
                x: 56,
                y: 12,
                w: 4,
                h: 4,
                sx: 55,
                sw: 3
            }
        },
        rightSleeve: {
            right: {
                x: 40,
                y: 16,
                w: 4,
                h: 12
            },
            front: {
                x: 44,
                y: 16,
                w: 4,
                h: 12,
                sw: 3
            },
            left: {
                x: 48,
                y: 16,
                w: 4,
                h: 12,
                sx: 47
            },
            back: {
                x: 52,
                y: 16,
                w: 4,
                h: 12,
                sx: 51,
                sw: 3
            },
            top: {
                x: 44,
                y: 28,
                w: 4,
                h: 4,
                sw: 3
            },
            bottom: {
                x: 48,
                y: 28,
                w: 4,
                h: 4,
                sx: 47,
                sw: 3
            }
        },
        leftTrousers: {
            right: {
                x: 0,
                y: 0,
                w: 4,
                h: 12
            },
            front: {
                x: 4,
                y: 0,
                w: 4,
                h: 12
            },
            left: {
                x: 8,
                y: 0,
                w: 4,
                h: 12
            },
            back: {
                x: 12,
                y: 0,
                w: 4,
                h: 12
            },
            top: {
                x: 4,
                y: 12,
                w: 4,
                h: 4
            },
            bottom: {
                x: 8,
                y: 12,
                w: 4,
                h: 4
            }
        },
        rightTrousers: {
            right: {
                x: 0,
                y: 16,
                w: 4,
                h: 12
            },
            front: {
                x: 4,
                y: 16,
                w: 4,
                h: 12
            },
            left: {
                x: 8,
                y: 16,
                w: 4,
                h: 12
            },
            back: {
                x: 12,
                y: 16,
                w: 4,
                h: 12
            },
            top: {
                x: 4,
                y: 28,
                w: 4,
                h: 4
            },
            bottom: {
                x: 8,
                y: 28,
                w: 4,
                h: 4
            }
        },

        cape: {
            right: {
                x: 0,
                y: 15,
                w: 1,
                h: 16
            },
            front: {
                x: 1,
                y: 15,
                w: 10,
                h: 16
            },
            left: {
                x: 11,
                y: 15,
                w: 1,
                h: 16
            },
            back: {
                x: 12,
                y: 15,
                w: 10,
                h: 16
            },
            top: {
                x: 1,
                y: 31,
                w: 10,
                h: 1
            },
            bottom: {
                x: 11,
                y: 31,
                w: 10,
                h: 1
            }
        }
    };


    window.SkinRender = SkinRender;
})(window);