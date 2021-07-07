# WC3 Auto Balancer


# What this tool does: #
* ## Auto Host ##
    * Click through the menus to host a lobby of your desired map
    * Full Auto host
        * Tries to join any observer, host, or spectator team
        * Starts the game once all non spectator/host/observer team slots are full
        * Attempts to quit the game once it is over (This needs major work, right now it only tries to press "q" every 15 seconds. Only works when any Victory or Defeat screen pops up)
* ## ELO Lookup and sorting ##
    * Grab the ELO of every player from www.wc3stats.com
        * Will figure out the best possible team combination, and figure out the best way to swap players for the least swaps.
          * If you are host, it will swap players
          * If you are not host it will suggest the team combination in chat  

For now maps must be added manually due to the way ELO data is retrieved. Until this process is flushed out:  
***Currently the only supported map for ELO Lookup and sorting is Hero Line Wars.*** Currently working with PyroTd devs to add support for them. Most maps can be added easily. Please [Submit a Request Here](https://github.com/kgallimore/wc3autobalancer/issues/new?title=Map%20Request&body=Map%20Name%3A%0A&labels=Map%20Request)
# What this tool is NOT: #
This tool is not a ghost++ replacement. It's not meant for any sort of 24/7 hosting bot, and although it could be used for that purpose, it is not scalable, nor is it meant to be scalable.  
***It can NOT interact with anything while in game.***  
Due to the way this tool works, the Warcraft 3 window should be in focus while it is executing any chat functions. While I can simulate clicks while the window is out of focus, I have to simulate keypresses at the OS level
- - - -
## What this tool modifies: ## 
This tool adds a registry key to AllowLocalFiles and then modifies the index.html page. It adds a script file that creates a websocket connection, that can then pass data to the main program. 
