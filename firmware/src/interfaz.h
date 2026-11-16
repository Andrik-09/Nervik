// Interfaz local: "una luz, un significado" (analogía del panel de avión, semana 6).
//  Energía      fija = alimentado
//  Comunicación fija = último envío correcto · parpadea = sin red o con mensajes en cola
//  Alerta       apagada N0 · lenta N1 · rápida N2 · fija N3
//  Buzzer       avisos cortos en N2, patrón insistente en N3 (alerta en cabina)
//  Botón        pulsación corta = autoprueba y reporte inmediato · 3 s = iniciar/terminar simulacro
#pragma once
#include <Arduino.h>

namespace interfaz {
  enum Boton { NADA, CORTO, LARGO };
  void iniciar();
  void actualizar(int nivel, bool comunicacionOk, bool simulacro);
  Boton boton();
  void destello();   // los tres LED a la vez (autoprueba)
}
