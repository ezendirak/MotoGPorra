"""Servicio de sincronización MotoGP -> Supabase.

Única pieza del sistema que habla con MotoGP (a través de `motogp_client`) y
la única que escribe en las tablas deportivas. El frontend nunca hace ninguna
de las dos cosas.
"""

__version__ = "0.1.0"
