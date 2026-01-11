# Lightgun Game – AI Context

## Introduction

This is a game I'm developing to be a lightgun arcade-style shooter. It runs via node server.js on port 8080 and serves game.html as the main game and should also launch controller.html so smart phones can connect to it as a lightgun controller using smart phone motion sensing. Uses mouse aiming and controls as backup if cannot connect to smart phone controller or if player rather use mouse and for testing purposes. Currently only setup for iPhone but plan to add Android support later. The game currently runs locally but I plan to either host the game or package into a stand-alone executable. 
Do not make commits or pushes to github unless I explicitely tell you to in a chat message.

## The current game loop is that intro rails for the scene runs which should move the player/camera into position for the lightgun sequence. The lightgun sequence consists of the player aiming the targeting reticle to use weapons and other items in their inventory to dispatch all enemies in the scene. Once all enemies are killed, the scene's exit rail sequence starts which moves the camera/player to the spot in the current scene where the exit is to the next scene. At the end of the exit rail sequence, the next scene loads and the loop repeats until all scenes in the level are complete. 

- Engine: Three.js + custom JS loop
- Input: uses smart phone as lightgun launching controller.html to connect to phone, also can use mouse control as backup and for testing purposes.
- Accuracy system:
  - Weapons have accuracy and projectileSpread
  - Dynamic reticle reflects spread
  - cycle through available weapons with mouse wheel. Currently have pistol, shotgun, assault rifle, sniper rifle, and rocket launcher for base weapons for testing, plan to add more varients.
  - Weapons and certain destructable objects can explode, explosions have radius, damage, shake the camera, and use particle FX
  
- scenes are defined using json data in their respective js files, for example, scene_w1_1.js and scene_w1_2.js. The first level is "Warehouse"
- Player has melee attack for close enemies.
- Enemies have different behavior patterns such as "pop out and shoot", "stand in the open and shoot", "move in repeating pattern", and "melee rush". Melee enemies are higher HP enemies that only use melee attacks when within range of the player.

##Planned features and updates

- Inventory:  med kits, temporary personal shield, grenades, view available weapons,
- Upgrade system- points gained to increase HP, accuracy, speed, gain features and abilities
- Shop to buy weapons, ammo, items, etc.
- Money earned for completing levels 
- Equipment:  body armor, helmet, gadgets, accessories
- Player chooses  what equipment/weapons to take on each mission based on the mission briefing.
- Player attributes, strength, dexterity, endurance, agility, intelligence
- strength determines weight of equipment can carry into missions, melee damage
- Dexterity determines weapon Accuracy
- Endurance determines HP and defense, overall durability
- Intelligence determines effectiveness of things requiring mental processing such as medical for how much HP med items heal, success in hacking/lockpicking, environmental awareness
- Possible crafting system to craft new weapons, ammo, gear, etc- spoken dialogue for player/ player allies/ enemies using my own voice acting and AI generated voice acting- AI-generated music