"""Namespace para los módulos de endpoints de alto nivel.

Cada archivo de este paquete se apoya únicamente en
``MotoGPClient._get`` (nunca en ``requests`` directamente) y expone una
clase ``XxxEndpoint`` que ``MotoGPClient`` compone como atributo
(``client.events``, ``client.riders``, ...), además de métodos de
conveniencia expuestos directamente en ``MotoGPClient``
(``get_calendar``, ``get_event``, ...).

Implementados hasta ahora:
    - ``events.py``

Pendientes: ``riders.py``, ``sessions.py``, ``classifications.py``,
``teams.py``, ``constructors.py``, ``categories.py``.
"""
