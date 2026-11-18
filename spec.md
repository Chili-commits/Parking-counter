The project is an application for a christmas farm 
It has two interfaces

## Both interfaces ##
- A top menu that allows you to change between the interfaces/applications
    - These should be called "Parking" and "backstage"
- There should be an indicator that gives the user feedback on the communication signal between the different  channels (can the backstage recieve updates from Parking or is the signal too low)

## Parked car counter Interface ##
- The interface should be translated to fit a phone model
- There should be a big green button with a plus
    - The button should make a counter go up with +1 when pressed
- There should be an indicator for, when the count was last refreshed
- an undo button incase the button press was a mistake

## Backstage interface ##

- a graph  indicating the amount of cars visited
    - the graph should be on the left side
    - x-axis = time
    y-axis = visitors
    - the possibility to change time interval for the graph display
- A view that has the following attributes 
    - current load -> Int 
    - Last timeframe -> int 00:00
    - Last update -> int 00:00
    - expected amout -> Int

## Cooperation between the two interfaces##
- Once the Parking interface has indicated that there is a new car, the backstage interface should update
- It should be possible to interact accross multiple devices 
