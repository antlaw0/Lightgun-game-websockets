[33mcommit 1c7957db4a8a14d4fc5fd441fb759379513ccbc0[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mAIbranch[m[33m, [m[1;31morigin/AIbranch[m[33m, [m[1;32mfeature/enemy-ai-fixes[m[33m, [m[1;32mcamfix[m[33m, [m[1;32mbackup-before-reset-20260115[m[33m)[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Jan 14 09:09:32 2026 -0600

    camfix: increase FPS movement speed

[33mcommit 3e6d36aa45d5ed2ee656eb8f03f13355342ad8c3[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Jan 13 17:50:40 2026 -0600

    Fix: enemy strafing selection, exo_red model, death-animation sequencing

[33mcommit 11ec6cd82ee53b6016bb3b69f833be4a0a1bc369[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Jan 13 16:29:43 2026 -0600

    Attach ak47.glb to rifle enemies (GLTFLoader import + hand-bone attach)

[33mcommit 862de3760a8e2c9427bc1763cd7bcc155e5de16d[m[33m ([m[1;32m3DPrototyping[m[33m)[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Jan 13 15:55:50 2026 -0600

    Remove debug proxies; register skinned meshes for hit detection; scale and ground enemies

[33mcommit 23c0c3854801b9c0267f2fe48a9538255c5597ff[m[33m ([m[1;31morigin/3DPrototyping[m[33m)[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Jan 12 11:26:18 2026 -0600

    Add static proxy meshes for skinned models to ensure visibility

[33mcommit dcbbba1ae97edd2506c3c8e56f45b05f42629c51[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Jan 12 11:12:16 2026 -0600

    Make enemy alignment robust: bbox fallback, clamp dy, force visibility

[33mcommit 324b8f804bd7cf800b952182482585c201981151[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Jan 12 09:06:41 2026 -0600

    Fix model scaling: explicit scene override and robust auto-scaling in enemy.js

[33mcommit 834e4244d9b35452fba37c0d68461323526d399e[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Jan 11 15:53:58 2026 -0600

    feat: add 3D mannequin, animations, and integrate 3D grunt

[33mcommit d44cd955d7b7e041bb098c13eb2e802c675c1287[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Jan 11 06:24:55 2026 -0600

    hud: reduce reticle kick to small vertical jitter (fewer frames, smaller magnitude)

[33mcommit 5f713b23f3b4cbdac990a5705ab343bac6e14c42[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Jan 11 06:12:32 2026 -0600

    recoil: add weapon recoil, player recoil state, factor into reticle and spread

[33mcommit 715f1f513ddebd1db9f927a2dfe891430cde8b1e[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Jan 11 06:00:13 2026 -0600

    hud: add screen-space muzzle flash, reticle kick, camera micro-recoil; wire HUD.onWeaponFire

[33mcommit 6a58486b123fd635e7dfabba8249bffc08bd0759[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Jan 9 14:52:57 2026 -0600

    fi: align projectiles with reticle, uniform cone spread, expose projectile properties, tune weapon accuracy, lower muzzle origin

[33mcommit f786cf57fca5aedeb2b2b3b8fd24e3fd220ea7f3[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Jan 7 09:33:18 2026 -0600

    successfully reincorporated enemy melee rush

[33mcommit 95da8fd05faceef7db3e7c13684df54b2f3a766b[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Jan 6 14:11:47 2026 -0600

    successfully reImplemented player melee attacks

[33mcommit db4d2d4efee61a79c48a92122bbc5bcdc7efcacd[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Jan 6 12:21:33 2026 -0600

    successfully reImplemented enemyvoicemanager

[33mcommit 76ff129ae195eeab77ae95066e189f735adfabf7[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 30 10:28:01 2025 -0600

    Implemented enemy melee system

[33mcommit 30a63f6c0fd831a51f3edaba2c5b95e7788fa7f8[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 29 18:56:24 2025 -0600

    Implemented camera shaking

[33mcommit 66ecbcbda9dbe2e346ee684322b43b71d748d83d[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 29 17:21:29 2025 -0600

    Metal barrel now explodes, made explosions last longer and expand better.

[33mcommit bed94fdde322be33204e0f8214646faecd2cf691[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 29 08:51:23 2025 -0600

    Fixed barrel texture and lighting, rotated hazard symbol to show properly

[33mcommit 044ba67723c6725581f71948122b03f684e4803f[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Dec 28 09:41:06 2025 -0600

    Implemented prefabLibrary.js, adjusted lighting.

[33mcommit 1fe1ca58b0c37450ec753ca99fad5134186b84b3[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 24 13:11:58 2025 -0600

    Fixed problem where next scene was triggering too soon after exit rail

[33mcommit dbe5bb7c401296406537761870ff4005fe94c9fc[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 24 12:02:08 2025 -0600

    Implemented sparks FX

[33mcommit a1a1c15c5bf5e0c9aa17a0612af602ea02529067[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 23 15:58:20 2025 -0600

    Camera Rail movement works start to finish, use master scene for smooth transitions between scenes door or no door

[33mcommit 9bdf137cb7ce90c19f5c4594bfa1767f4e48cf93[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 22 14:02:29 2025 -0600

    Implemented enabling and disabling Enemy AI with F4

[33mcommit c54041dd27ddc4e5062bee0a54f27356e56611a7[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 22 11:49:38 2025 -0600

    Implemented camera rail system, scene transitions still work, added camera debug hud info when press F3

[33mcommit 6404b79fb5ca9f20276afc08956e26a1e7f05975[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 22 09:44:44 2025 -0600

    added scene_w1_2 as an L-shaped hallway

[33mcommit 655e1631583a31a84ce4ef8503ce33b8066d1559[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Dec 21 16:16:16 2025 -0600

    Implemented SceneManager to transition from scene to scene after all enemies defeated

[33mcommit 3dfd6fc865d15e1741c788ecac4b77dee100b31c[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 19 22:43:56 2025 -0600

    Implemented shotgun spread firing

[33mcommit a5b75d49d80fb5a9585d1f08d306712c26f21d28[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 19 13:45:30 2025 -0600

    Implemented moving pattern enemies

[33mcommit 6efd98ed4dfec65cc871dbdc6e1fe062c67241cd[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Dec 18 19:59:08 2025 -0600

    Enemies now cannot fire during reload, introduced enemy pauseFireMs interval

[33mcommit ea28fb81fc13e3cc6843881331598413526a9f5b[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Dec 18 19:35:32 2025 -0600

    Enemies have different weapons, gruntC is now sniper, fixed bug with reloading for enemies

[33mcommit c2281dca6bb6ebd2db7b168410941e6dbc60b18e[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Dec 18 13:30:44 2025 -0600

    Fixed explosion particle size scaling to blast radius

[33mcommit c451e8cacb8bdbce4e4d068be5864792b1f39efb[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Dec 18 12:08:02 2025 -0600

    Implemented floor, walls, and ceiling impact sounds and collision logic. Improved impact sound system to play hitsounds for any mesh with hitSounds array

[33mcommit 2e4b8b4fb15639305a351e763e288a2558463775[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 17 14:15:10 2025 -0600

    Fixed depricated three import, fixed explosions again

[33mcommit a78e064c3ee4284473e8accedd6e2bdec149b9f0[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 17 09:45:13 2025 -0600

    Implemented material types for props, fixed wall1 placement, reworked explosion logic to work with new unifiedProjectile spawning, fixed issue with props not having their static meshes in sync where they are visually

[33mcommit 84f3f4c0fc231e78cb510b08749291c7245802e6[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 16 15:30:17 2025 -0600

    Fixed bullets not delivering collision damage and stuff instead of raycastin, switched to rayCast sweep

[33mcommit 95182ad0aaf54d4b4da46e1e3cd4a4e54d20ecc7[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 16 09:31:44 2025 -0600

    Fixed enemy leaning cover, now have full four enemies in scene working

[33mcommit e480d6caf0a469100df785c1525aac960febddbd[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 15 13:06:32 2025 -0600

    Added better lights, enabled shadows

[33mcommit e90a92d4c26f58d730759e9ae730976d891a8f55[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Mon Dec 15 09:01:45 2025 -0600

    Explosions finally finally work, look correct, deal damage, get values from weapon, everything

[33mcommit fc2f0227dbc6ea83497367d2c6fd27876cf90be2[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sun Dec 14 08:26:00 2025 -0600

    Explosions work, still don't deal blast damage yet though

[33mcommit d45207cc362cc9e918fdd4f7c275f9882f5fe934[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sat Dec 13 12:39:48 2025 -0600

    Implemented explosions based onspawnTestExplosion, still need to tweak to incorporate weapon info into explosion

[33mcommit 7d6d26f9493a4b91051dc03815727df2ba09c94b[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 9 13:08:50 2025 -0600

    Implemented multiple weapons, autofire fixed, weapon sounds, weapon switching

[33mcommit 670f430a293877b9f6538139b5487ec1d1af07a8[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sat Dec 6 14:06:40 2025 -0600

    Implemented explosions

[33mcommit 1db2cb7f0655924bb4322c658422200f3fb7d556[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 5 14:20:38 2025 -0600

    Everything frickin works, 3D room, props, indestructable wall prop, and now have killAllEnemies with press K key

[33mcommit 919e36e87782f9507127b18c29ce1e73ea63d837[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 5 07:57:20 2025 -0600

    Implemented scene lighting

[33mcommit 42f34f4dca3df8f887b827333c06f122dee45391[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 5 06:23:04 2025 -0600

    Implemented 3D room instead of static background

[33mcommit e624d7bc93c8fbb6b38e487bafea45ede1461987[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Dec 5 06:00:16 2025 -0600

    Implemented better 2D static background

[33mcommit 962b2a3d8d59cba5e54a77a925611e3ae844f49a[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Dec 4 16:19:23 2025 -0600

    Implemented enemy cover mechanics and animations

[33mcommit 585e2a4bc044a0ad1e33563afffe1b70dfd2995b[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 3 19:30:14 2025 -0600

    Implemented capsule bullets and tracer effect

[33mcommit 895585262632a74f05de06a6e25767074a1f8901[m[33m ([m[1;31morigin/SceneImplementation[m[33m)[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Wed Dec 3 18:28:01 2025 -0600

    Implemented autofire logic

[33mcommit 0f33cc940cf61394b2c786de7c3abef83947e2eb[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Dec 2 17:04:06 2025 -0600

    Reloading and ammo counting fixed

[33mcommit 0e80576584736f80cd6e82b8d86df99847fee813[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Sat Nov 29 20:22:24 2025 -0600

    Implemented enemy projectiles firing at camera

[33mcommit 9e544f95fbe95cf4954754fb037d0b3558aa3db2[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Nov 28 18:26:34 2025 -0600

    Implemented background image instead of 3D planes

[33mcommit f27638e5e2ba4cba38a121550320214a32123acc[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Nov 28 09:48:09 2025 -0600

    Fixed multiple hits per one shot issue, now takes 3 shots to take down enemy

[33mcommit 4eedf13c5e135cb2618004eac8eacb1915c24ffe[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Fri Nov 28 09:35:01 2025 -0600

    Enemies take 2 shots instead of 3, backup for big change

[33mcommit 19eb32947164b9e40096aa8e35eb92bb774d322d[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Nov 27 11:37:25 2025 -0600

    All works except for hitting targets

[33mcommit 060295e851aeb44f2d19c0983a65a67cc8a7ebed[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Nov 27 09:26:07 2025 -0600

    Initial commit

[33mcommit e0aaa969c518505fe9c15a92cb7978d9439473ea[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Nov 25 15:26:32 2025 -0600

    Implemented three.js scene, working reticle, three targets with health, hit and miss detection works

[33mcommit a7608b9dd741f64a0615dc532aa8da0cdf649dfe[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Nov 25 11:49:04 2025 -0600

    Fixed reticle not moving after calibrate and fire sound plays rapidly now

[33mcommit 36d9d95d4ffb04b61c905b9f592392a5e92f53c7[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Tue Nov 25 10:00:13 2025 -0600

    Complete rewrite, reticle movement works as expected using phone alpha for realistic aiming

[33mcommit 0082556f29a43bd9a9101f8bc7f740f946cbf814[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Nov 20 17:07:22 2025 -0600

    Fixed reticle movement

[33mcommit e086c1b17ab7de38aa42354ac2afffb4a84ab665[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Nov 20 15:53:17 2025 -0600

    Initial commit

[33mcommit 50513bab64434e0f7124440f76ab659929f875ce[m
Author: antlaw0 <antlaw0@gmail.com>
Date:   Thu Nov 20 15:49:23 2025 -0600

    Initial commit
