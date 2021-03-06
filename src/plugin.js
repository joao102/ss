//=============================================================================
// Maze.js
//=============================================================================

/*:
@plugindesc Simple raycasting engine which turns the game maps into 3D mazes.
@author Hash'ak'Gik

@param resume
@desc Resume string.
@default Resume

@param retry
@desc Retry string.
@default Retry

@param quit
@desc Quit string.
@default Quit

@param yes
@desc Yes string.
@default Yes

@param no
@desc No string.
@default No

@param quality
@desc Quality setting string.
@default Quality

@param low
@desc Low quality string.
@default Low

@param medium
@desc Medium quality string.
@default Medium

@param High
@desc High quality string.
@default High

@param auto
@desc Automatic quality string.
@default Auto

@param block_width
@desc Size of each 3D block.
@default 1

@param gen_floor
@desc Tile id for the generated maps' floor.
@default 2860

@param gen_wall
@desc Tile id for the generated maps' walls.
@default 6335

@param gen_tileset_id
@desc Tileset id for the generated maps.
@default 3

@help
This plugin generates a 3D maze from an existing map or randomly and can work in two different "modes":
- Normal mode: the maze is simply a different appearance of a game map (running events won't be stopped),
- Maze mode: the maze acts as a minigame which will pause any event until it's won ($mazeClear = true) or lost ($mazeClear = false).

Rendering quality:
Four quality settings are available from the menu (Automatic, Low, Medium and High).
Automatic quality will start at Medium and will:
- reduce quality quickly if the framerate drops below 20 fps,
- increase quality slowly if the framerate remains above 59 fps for a long enough time.
This behaviour guarantees smooth gameplay even in canvas mode.

Compass:
During 3D mode a compass is shown on screen, its needle will be attracted by some events (see section below),
with a pull proportional to their distance from the player (i.e. a close event will pull the compass more than a farther one).
Fake goals' pull can be configured (a true goal has a strength of 1, so a fake goal with strength = 0.5 will be half as strong as a true goal,
while a fake goal with strength = 2 will be twice as strong as a real goal).

Events notes:
<goal> The maze's compass will point towards this event, usually an event with this note should include the "Maze success" plugin command,
<fake:strength> The maze's compass will be interfered by this event with the specified strength (the event might include the "Maze fail" command).

Plugin commands:
Maze on [retry [quit]]
    Turns on the 3D effect without changing map (normal mode). Can enable/disable "retry" and "quit" options in the pause menu.
    For example: "Maze on false true" disables the retry option, but keeps the quit option enabled.
Maze off
    Turns off the 3D effect.
Maze toggle [retry [quit]]
    Toggles between on and off (normal mode).
Maze map id x y direction [retry [quit]]
    Turns on the 3D effect on a new map (maze mode). When quitting, the player will return to the previous map.
    For example: "Maze map 2 10 15 6" loads map 002 and places the player at coordinates 10,15 facing east (direction 6).
Maze generate n [retry [quit]]
    Randomly generates a map large 2 * n tiles and automatically places a single event as a goal (maze mode).
Maze success
    Turns off the 3D effect, returns the player to the previous map and sets $mazeClear to true.
Maze fail
    Turns off the 3D effect, returns the player to the previous map and sets $mazeClear to false (same as selecting "Quit" from the menu).
*/


/**
 * Stores the maze's success state.
 * True if the maze was escaped by triggering the right event, false if the maze was left from the pause menu or by triggering the wrong event.
 * @typedef $mazeClear
 * @type {boolean}
 */
var $mazeClear = false;

/**
 * @namespace Maze
 */
var Maze = (function (my) {

    var parameters = PluginManager.parameters('Maze');

    my.yes = String(parameters['yes'] || "Yes");
    my.no = String(parameters['no'] || "No");
    my.retry = String(parameters['retry'] || "Retry");
    my.quit = String(parameters['quit'] || "Quit");
    my.resume = String(parameters['resume'] || "Resume");
    my.quality = String(parameters['quality'] || "Quality");
    my.qLow = String(parameters['low'] || "Low");
    my.qMedium = String(parameters['medium'] || "Medium");
    my.qHigh = String(parameters['high'] || "High");
    my.qAuto = String(parameters['auto'] || "Auto");
    my.blockWidth = Number(parameters['block_width'] || 1);


    /**
     * Size of the generated maps. It will be set from plugin commands (must be >= 4).
     * @typedef genSize
     * @memberOf Maze
     */
    my.genSize = 0;
    /**
     * Tile id for the floor of generated maps.
     * @typedef genFloor
     * @memberOf Maze
     */
    my.genFloor = Number(parameters['gen_floor'] || 2860);
    /**
     * Tile id for the wall of generated maps.
     * @typedef genWall
     * @memberOf Maze
     */
    my.genWall = Number(parameters['gen_wall'] || 6335);
    /**
     * Tileset id for the generated maps.
     * @typedef genTilesetId
     * @memberOf Maze
     */
    my.genTilesetId = Number(parameters['gen_tileset_id'] || 3);

    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'Maze') {
            switch (args[0]) {
                case "on":
                    if (!(SceneManager._scene instanceof my.Scene_Maze)) {
                        my.oldPosition = {
                            id: $gameMap._mapId,
                            x: $gamePlayer._x,
                            y: $gamePlayer._y,
                            direction: $gamePlayer._direction
                        };
                        my.isMaze = false;
                        if (args[1] === "false") {
                            my.canRetry = false;
                        }
                        else {
                            my.canRetry = true;
                        }
                        if (args[2] === "false") {
                            my.canQuit = false;
                        }
                        else {
                            my.canQuit = true;
                        }

                        SceneManager.goto(my.Scene_Maze);
                    }
                    break;
                case "off":
                    if (SceneManager._scene instanceof my.Scene_Maze) {
                        SceneManager.goto(Scene_Map);
                    }
                    break;
                case "toggle":
                    if (SceneManager._scene instanceof my.Scene_Maze) {
                        SceneManager.goto(Scene_Map);
                    }
                    else {
                        my.oldPosition = {
                            id: $gameMap._mapId,
                            x: $gamePlayer._x,
                            y: $gamePlayer._y,
                            direction: $gamePlayer._direction
                        };
                        my.isMaze = false;
                        if (args[1] === "false") {
                            my.canRetry = false;
                        }
                        else {
                            my.canRetry = true;
                        }
                        if (args[2] === "false") {
                            my.canQuit = false;
                        }
                        else {
                            my.canQuit = true;
                        }

                        SceneManager.goto(my.Scene_Maze);
                    }
                    break;
                case "map":
                    if (!(SceneManager._scene instanceof my.Scene_Maze)) {
                        my.isMaze = true;
                        my.oldPosition = {
                            id: $gameMap._mapId,
                            x: $gamePlayer._x,
                            y: $gamePlayer._y,
                            direction: $gamePlayer._direction
                        };
                        var id = Number(args[1]);
                        var x = Number(args[2]);
                        var y = Number(args[3]);
                        var dir = Number(args[4]);
                        $gamePlayer.reserveTransfer(id, x, y, dir, 2);

                        if (args[5] === "false") {
                            my.canRetry = false;
                        }
                        else {
                            my.canRetry = true;
                        }
                        if (args[6] === "false") {
                            my.canQuit = false;
                        }
                        else {
                            my.canQuit = true;
                        }

                        SceneManager.goto(my.Scene_Maze);
                    }
                    break;
                case "generate":
                    if (!(SceneManager._scene instanceof my.Scene_Maze)) {
                        my.isMaze = true;
                        my.oldPosition = {
                            id: $gameMap._mapId,
                            x: $gamePlayer._x,
                            y: $gamePlayer._y,
                            direction: $gamePlayer._direction
                        };

                        my.genSize = Math.max(Number(args[1]), 4);

                        $gamePlayer.reserveTransfer(-1, Math.floor(my.genSize / 2) * 2, Math.floor(my.genSize / 2) * 2, 2, 2);

                        if (args[2] === "false") {
                            my.canRetry = false;
                        }
                        else {
                            my.canRetry = true;
                        }
                        if (args[3] === "false") {
                            my.canQuit = false;
                        }
                        else {
                            my.canQuit = true;
                        }

                        SceneManager.goto(my.Scene_Maze);
                    }
                    break;
                case "success":
                    if (SceneManager._scene instanceof my.Scene_Maze) {
                        $mazeClear = true;
                        if (my.isMaze) {
                            $gamePlayer.reserveTransfer(my.oldPosition.id, my.oldPosition.x, my.oldPosition.y, my.oldPosition.direction, 2);
                        }
                        SceneManager.goto(Scene_Map);
                    }
                    break;
                case "fail":
                    if (SceneManager._scene instanceof my.Scene_Maze) {
                        $mazeClear = false;
                        if (my.isMaze) {
                            $gamePlayer.reserveTransfer(my.oldPosition.id, my.oldPosition.x, my.oldPosition.y, my.oldPosition.direction, 2);
                        }
                        SceneManager.goto(Scene_Map);
                    }
                    break;
            }
        }
    };


    /**
     * Generates a random maze with a depth first algorithm ({@link https://en.wikipedia.org/wiki/Maze_generation_algorithm}). Since it's invoked by DataManager, its parameters must be passed with the variables:
     * {@link Maze.genSize}, {@link Maze.genFloor}, {@link Maze.genWall} and {@link Maze.genTilesetId}.
     *
     * @memberOf Maze
     */
    my.generateMaze = function () {
        var cells = new Array(my.genSize);
        for (var i = 0; i < my.genSize; i++) {
            cells[i] = new Array(my.genSize);
            cells[i].fill(false);
        }

        var maze = new Array(my.genSize * 2);
        for (var i = 0; i < my.genSize * 2; i++) {
            maze[i] = new Array(my.genSize * 2);
            maze[i].fill(false);
        }

        // Keep the initial position, for player's sake.
        var init = {x: Math.floor(my.genSize / 2) * 2, y: Math.floor(my.genSize / 2) * 2};

        // Start from the initial position and mark the cell as visited.
        var current = {x: Math.floor(my.genSize / 2), y: Math.floor(my.genSize / 2)};
        cells[current.x][current.y] = true;

        var unvisited = my.genSize * my.genSize - 1;
        var stack = [];
        var neighbours = [];

        do {
            unvisited = 0;
            for (var i = 0; i < my.genSize; i++) {
                unvisited += cells[i].filter(c => {
                    return !c;
                }).length;
            }

            neighbours = [
                {x: current.x - 1, y: current.y},
                {x: current.x + 1, y: current.y},
                {x: current.x, y: current.y - 1},
                {x: current.x, y: current.y + 1}
            ].filter(c => {
                return c.x > 0 && c.x < my.genSize - 1 && c.y > 0 && c.y < my.genSize - 1 &&
                    !cells[c.x][c.y];
            });
            
            // Pick a random neighbour.
            if (neighbours.length > 0) {
                var k = Math.floor(Math.random() * neighbours.length);
                stack.push({x: current.x, y: current.y});

                // Remove the wall between the current node and the selected neighbour.
                maze[2 * current.x][2 * current.y] = true;
                if (neighbours[k].x === current.x) {
                    if (neighbours[k].y === current.y + 1) {
                        maze[2 * current.x][2 * current.y + 1] = true;
                    }
                    else if (neighbours[k].y === current.y - 1) {
                        maze[2 * current.x][2 * current.y - 1] = true;
                    }
                }
                else if (neighbours[k].y === current.y) {
                    if (neighbours[k].x === current.x + 1) {
                        maze[2 * current.x + 1][2 * current.y] = true;
                    }
                    else if (neighbours[k].x === current.x - 1) {
                        maze[2 * current.x - 1][2 * current.y] = true;
                    }
                }

                // Mark the current cell as visited and move to the selected neighbour.
                current = {x: neighbours[k].x, y: neighbours[k].y};
                cells[current.x][current.y] = true;

            }
            else if (stack.length > 0) { // If there are no available neighbours, backtrack to previously visited cells.
                current = stack.pop();
            }
        } while (unvisited > 0 && !(neighbours.length === 0 && stack.length === 0));
        // Repeat as long as there are unvisited cells and there is at least one cell with available neighbours.

        // Generate two events (the event with ID 0 on a map is always null, the other one will trigger a "Maze success" command).
        $dataMap.events.push(null);
        var ev;

        // If the plugin was called from an event on map, there will be at least one event with the locked flag set.
        // The maze's goal will have the same appearance of the calling event.
        if ($gameMap._events.filter(e => {
            return e != null && e._locked;
        }).length > 0) {
            ev = $gameMap._events.filter(e => {
                return e != null && e._locked;
            })[0].event();

            ev.id = 1;
            ev.note = "<goal>";
            ev.pages[0].through = false;
            ev.pages[0].trigger = 0;
            ev.pages[0].directionFix = true;
            ev.pages[0].image.direction = 2;
            ev.pages[0].list = [
                {
                    "code": 356,
                    "indent": 0,
                    "parameters": [
                        "Maze success"
                    ]
                },
                {
                    "code": 0,
                    "indent": 0,
                    "parameters": []
                }
            ];
        }
        else { // Otherwise, the goal will have a dummy "Actor1" appearance.
            console.warn("Invoking event not found. Creating dummy event.");
            ev = {
                "id": 1,
                "name": "EV001",
                "note": "<goal>",
                "pages": [{
                    "conditions": {
                        "actorId": 1,
                        "actorValid": false,
                        "itemId": 1,
                        "itemValid": false,
                        "selfSwitchCh": "A",
                        "selfSwitchValid": false,
                        "switch1Id": 1,
                        "switch1Valid": false,
                        "switch2Id": 1,
                        "switch2Valid": false,
                        "variableId": 1,
                        "variableValid": false,
                        "variableValue": 0
                    },
                    "directionFix": true,
                    "image": {
                        "tileId": 0,
                        "characterName": "Actor1",
                        "direction": 2,
                        "pattern": 0,
                        "characterIndex": 0
                    },
                    "list": [
                        {
                            "code": 356,
                            "indent": 0,
                            "parameters": [
                                "Maze success"
                            ]
                        },
                        {
                            "code": 0,
                            "indent": 0,
                            "parameters": []
                        }
                    ],
                    "moveFrequency": 3,
                    "moveRoute": {
                        "list": [{"code": 0, "parameters": []}],
                        "repeat": true,
                        "skippable": false,
                        "wait": false
                    },
                    "moveSpeed": 3,
                    "moveType": 0,
                    "priorityType": 1,
                    "stepAnime": true,
                    "through": false,
                    "trigger": 0,
                    "walkAnime": true
                }],
                "x": 0,
                "y": 0
            };
        }


        // Write $dataMap with the generated maze and events.
        $dataMap = {};
        $dataMap.events = [];

        $dataMap.width = maze.length;
        $dataMap.height = maze[0].length;
        $dataMap.scrollType = 0;
        $dataMap.tilesetId = my.genTilesetId;

        var width = maze.length;
        var height = maze[0].length;


        $dataMap.data = new Array(6 * width * height);
        $dataMap.data.fill(0);

        // Fill the map's data structure, while keeping track of the walkable tiles.
        var goals = [];
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                if (maze[i][j]) {
                    $dataMap.data[i + j * width] = my.genFloor;
                    if (i !== init.x && j !== init.y) {
                        goals.push({x: i, y: j});
                    }
                }
                else {
                    $dataMap.data[i + j * width] = my.genWall;
                }
            }
        }

        // From any of the walkable tiles, choose randomly a goal position.
        var goal = goals[Math.floor(Math.random() * goals.length)];


        // Set the goal event's position.
        ev.x = goal.x;
        ev.y = goal.y;
        $dataMap.events.push(ev);
    };


    var _loadMapData = DataManager.loadMapData;
    /**
     * Overrides the default DataManager.loadMapData method.
     * @param mapId if -1 generates a random maze, otherwise it keeps the default behaviour.
     */
    DataManager.loadMapData = function (mapId) {
        if (mapId === -1) {
            my.generateMaze();
        }
        else {
            _loadMapData.call(this, mapId);
        }
    };

    // Rewrite Input._updateGamepadState to include axes informations and whether the last input came from a gamepad or the keyboard.
    Input._updateGamepadState = function(gamepad) {
        var lastState = this._gamepadStates[gamepad.index] || [];
        var newState = [];
        var buttons = gamepad.buttons;
        var axes = gamepad.axes;
        var threshold = 0.5;
        newState[12] = false;
        newState[13] = false;
        newState[14] = false;
        newState[15] = false;
        for (var i = 0; i < buttons.length; i++) {
            newState[i] = buttons[i].pressed;
        }
        if (axes[1] < -threshold) {
            newState[12] = true;    // up
        } else if (axes[1] > threshold) {
            newState[13] = true;    // down
        }
        if (axes[0] < -threshold) {
            newState[14] = true;    // left
        } else if (axes[0] > threshold) {
            newState[15] = true;    // right
        }
        for (var j = 0; j < newState.length; j++) {
            if (newState[j] !== lastState[j]) {
                var buttonName = this.gamepadMapper[j];
                if (buttonName) {
                    this._currentState[buttonName] = newState[j];
                }
            }
        }
        this._gamepadStates[gamepad.index] = newState;
        this._axes = gamepad.axes;

        this._lastInputIsGamepad = newState.filter(b => {return b === true;}).length > 0;
    };

    // Rewrite Input._onKeyDown to include whether the last input came from a gamepad or the keyboard.
    Input._onKeyDown = function(event) {
        if (this._shouldPreventDefault(event.keyCode)) {
            event.preventDefault();
        }
        if (event.keyCode === 144) {    // Numlock
            this.clear();
        }
        var buttonName = this.keyMapper[event.keyCode];
        if (ResourceHandler.exists() && buttonName === 'ok') {
            ResourceHandler.retry();
        } else if (buttonName) {
            this._currentState[buttonName] = true;
        }
        this._lastInputIsGamepad = false;
    };

    // Checks where the last input came from.
    Input.isLastInputGamepad = function() {
        return !!this._lastInputIsGamepad;
    };

    // Returns the value for a given axis. If the value is below the deadzone it returns 0.
    Input.readAxis = function(axis, deadzone = 0.20) {
        var ret = 0;
        if (this._axes && Math.abs(this._axes[axis]) >= deadzone) {
            ret = this._axes[axis];
        }
        return ret;
    };

    var _ti_onTouchMove = TouchInput._onTouchMove;
    TouchInput._onTouchMove = function(event) {
        var oldX = this._x;
        var oldY = this._y;
        _ti_onTouchMove.call(this, event);

        this._dx = this._x - oldX;
        this._dy = this._y - oldY;
    };

    TouchInput.isLastInputTouch = function() {
        return this._screenPressed;
    };

    Object.defineProperty(TouchInput, 'dx', {
        get: function() {
            return this._dx;
        },
        configurable: true
    });

    Object.defineProperty(TouchInput, 'dy', {
        get: function() {
            return this._dy;
        },
        configurable: true
    });

    return my;
}(Maze || {}));