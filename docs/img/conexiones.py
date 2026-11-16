import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
K='#000'; G='#777'
fig, ax = plt.subplots(figsize=(13, 8.2)); ax.axis('off'); ax.set_xlim(0, 13); ax.set_ylim(0, 8.2)
def caja(x, y, w, h, t, sub='', dash=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.04', fc='white', ec=K, lw=1.8, ls='--' if dash else '-'))
    ax.text(x + w/2, y + h - 0.28, t, ha='center', va='top', fontsize=11, weight='bold')
    if sub: ax.text(x + w/2, y + h - 0.62, sub, ha='center', va='top', fontsize=8.5, color=G)
# Pico
px, py, pw, ph = 5.2, 1.2, 2.6, 5.8
caja(px, py, pw, ph + 0.4, 'Pico W (RP2040)')
izq = [('GP0  TX', 6.3), ('GP1  RX', 6.0), ('GP4  TX', 5.4), ('GP5  RX', 5.1), ('GP14 PWRKEY', 4.8), ('GP8  SDA', 4.1), ('GP9  SCL', 3.8), ('3V3', 2.4), ('GND', 2.1), ('VSYS', 1.6)]
der = [('GP16 MISO', 6.3), ('GP17 CS', 6.0), ('GP18 SCK', 5.7), ('GP19 MOSI', 5.4), ('GP10 LED energía', 4.6), ('GP11 LED comunicación', 4.3), ('GP12 LED alerta', 4.0), ('GP13 buzzer', 3.7), ('GP15 botón prueba', 3.2), ('RUN  botón reinicio', 2.9), ('GP22 ignición', 2.5), ('GP26 ADC alimentación', 2.1), ('GP27 ADC batería', 1.8)]
for t, y in izq: ax.text(px + 0.1, y, t, fontsize=7.6, va='center', family='monospace')
for t, y in der: ax.text(px + pw - 0.1, y, t.split()[0], fontsize=7.6, va='center', ha='right', family='monospace')
def cable(x1, y1, x2, y2, etiqueta='', dash=False):
    ax.plot([x1, x2], [y1, y2], color=K, lw=1.3, ls='--' if dash else '-')
    if etiqueta: ax.text((x1 + x2)/2, max(y1, y2) + 0.06, etiqueta, fontsize=7.2, ha='center', va='bottom', color=G)
# GNSS
caja(0.3, 5.6, 2.9, 1.1, 'Receptor GNSS', 'LC76G (o L76K / NEO-6M)\nVCC a 3V3 · GND común')
cable(3.2, 6.3, px, 6.3, 'RX ← TX Pico'); cable(3.2, 6.0, px, 6.0, 'TX → RX Pico')
# Modem
caja(0.3, 4.4, 2.9, 1.05, 'Módem SIM7080G', 'solo env pico_sim7080g', dash=True)
cable(3.2, 5.4, px, 5.4, dash=True); cable(3.2, 5.1, px, 5.1, dash=True); cable(3.2, 4.8, px, 4.8, dash=True)
# IMU
caja(0.3, 3.3, 2.9, 0.95, 'IMU LSM6DSOX', 'opcional', dash=True)
cable(3.2, 4.1, px, 4.1, dash=True); cable(3.2, 3.8, px, 3.8, dash=True)
# Power
caja(0.3, 1.2, 2.9, 1.7, 'Alimentación', 'USB 5 V en banco\nbuck 12/24 V→5 V en camión')
cable(3.2, 1.6, px, 1.6, '5 V'); cable(3.2, 2.1, px, 2.1, 'GND común')
# CAN
caja(9.8, 5.2, 2.9, 1.5, 'MCP2515 + transceptor', 'CAN J1939 · solo escucha\n(ISO1042 en la PCB final)', dash=True)
for y in (6.3, 6.0, 5.7, 5.4): cable(px + pw, y, 9.8, y, dash=True)
ax.text(11.25, 4.95, 'CAN_H / CAN_L → cable Deutsch 9 pines', fontsize=7.4, ha='center', color=G)
# LEDs
caja(9.8, 3.45, 2.9, 1.35, '3 LED + buzzer', '330 Ω por LED · todo a GND')
for y in (4.6, 4.3, 4.0, 3.7): cable(px + pw, y, 9.8, y)
# Buttons
caja(9.8, 2.55, 2.9, 0.8, '2 botones', 'a GND (pull-up interno)')
cable(px + pw, 3.2, 9.8, 3.05); cable(px + pw, 2.9, 9.8, 2.8)
# ADC
caja(9.8, 1.15, 2.9, 1.25, 'Divisores de voltaje', '100k/10k desde 12/24 V\n10k/10k desde la celda', dash=True)
for y in (2.1, 1.8): cable(px + pw, y, 9.8, y, dash=True)
cable(px + pw, 2.5, 9.3, 2.5, dash=True); ax.text(8.75, 2.44, 'ignición (interruptor a 3V3)', fontsize=7, ha='center', va='top', color=G)
ax.text(6.5, 0.55, 'Línea continua: mínimo para el prototipo de banco (Pico W + GNSS + LED + botones).   Línea punteada: opcional.', ha='center', fontsize=9)
ax.text(6.5, 7.9, 'Conexiones del prototipo Nervik en protoboard', ha='center', fontsize=14, weight='bold')
plt.savefig('/home/claude/nervik/docs/img/conexiones.png', dpi=170, bbox_inches='tight', facecolor='white')
