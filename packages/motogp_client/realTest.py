from motogp_client import MotoGPClient

with MotoGPClient() as client:
    calendar = client.get_calendar_current()
    print(f"{len(calendar)} eventos en la temporada actual")

    riders = client.get_riders(category="MotoGP")
    print(f"{len(riders)} pilotos de MotoGP")
    print(riders[0].full_name, riders[0].team_name)

    result = client.get_latest_race_results(category="MotoGP")
    print(f"Último GP: {result.event_name} ({result.circuit})")
    for entry in result.podium:
        print(entry.position, entry.rider_name, entry.time)

    races = client.get_completed_race_results(category="MotoGP")
    print(f"Carreras hechas: ")
    for entry in races:
        print(entry.event_name, entry.circuit)
        for pl in entry.podium:
                print(pl.position, pl.rider_name, pl.time)