import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

interface Sala {
  numero: number;
  pelicula: string;
  estado: 'disponible' | 'limpiando' | 'sucia';
  proximaApertura: string;
  tiempoEstimado?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  salaSeleccionada: number | null = null;
  salas: Sala[] = [];
  menuColapsado: boolean = true;
  usuarioActivo: any = null;

  private apiUrl: string = '';
  ultimasActividades: any[] = [];

  // --- CONFIGURACIÓN GRÁFICA DE BARRAS (Salas con más incidencias) ---
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: { x: {}, y: { min: 0 } },
    plugins: { legend: { display: false } }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Incidencias', backgroundColor: '#0B2F61' }]
  };

  // --- CONFIGURACIÓN GRÁFICA DE PASTEL (Activos en mantenimiento) ---
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' }
    }
  };
  public pieChartType: ChartType = 'pie';
  public pieChartData: ChartData<'pie'> = {
    labels: ['En Mantenimiento', 'Sucios'],
    datasets: [{ data: [], backgroundColor: ['#f59e0b', '#ef4444'] }]
  };

  constructor(private router: Router, private cdr: ChangeDetectorRef) { 
    this.configurarApiDinamica();
  }

  private configurarApiDinamica() {
    const host = window.location.hostname;
    this.apiUrl = host.includes('devtunnels.ms')
      ? `https://${host.replace('-4200', '-3000')}/api`
      : `http://${host}:3000/api`;
  }

  ngOnInit() {
    const datosUsuario = localStorage.getItem('usuario');
    if (datosUsuario) {
      this.usuarioActivo = JSON.parse(datosUsuario);
      console.log('Usuario activo en el Dashboard:', this.usuarioActivo);
    }

    if (this.router.url === '/dashboard') {
      this.salaSeleccionada = null;
      this.menuColapsado = true; 
    } else if (this.router.url.includes('/dashboard/salas/')) {
      const partes = this.router.url.split('/');
      this.salaSeleccionada = parseInt(partes[partes.length - 1], 10);
      this.menuColapsado = true; 
    }

    if (this.salaSeleccionada === null) {
      this.cargarDatosDashboard();
    }
  }

  async cargarDatosDashboard() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // 1. Cargar Gráfica de Barras
      const resBarras = await fetch(`${this.apiUrl}/asientos/dashboard/salas-incidencias`, { headers });
      if (resBarras.ok) {
        const datos = await resBarras.json();
        this.barChartData.labels = datos.map((d: any) => d.sala);
        this.barChartData.datasets[0].data = datos.map((d: any) => d.incidencias);
      }

      // 2. Cargar Gráfica de Pastel
      const resPastel = await fetch(`${this.apiUrl}/asientos/dashboard/estatus-activos`, { headers });
      if (resPastel.ok) {
        const datos = await resPastel.json();
        this.pieChartData.datasets[0].data = [datos.mantenimiento, datos.sucio];
      }

      // 3. Cargar Tabla de Actividad Histórica
      const resTabla = await fetch(`${this.apiUrl}/asientos/dashboard/ultimas-actividades`, { headers });
      if (resTabla.ok) {
        this.ultimasActividades = await resTabla.json();
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al poblar las métricas del dashboard:', error);
    }
  }

  formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-MX', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  toggleMenu() {
    this.menuColapsado = !this.menuColapsado;
  }

  seleccionarSala(numero: number) {
    this.salaSeleccionada = numero;
    this.menuColapsado = true; 
    console.log(`Cambiando a la vista detallada de la Sala ${numero} y colapsando menú`);
  }

  irADatosGenerales() {
    this.salaSeleccionada = null; 
    this.menuColapsado = false; 
    this.router.navigate(['/dashboard']); 
    this.cargarDatosDashboard(); 
    console.log('Regresando a los datos generales y expandiendo menú');
  }

  verDatosUsuario() {
    alert(`Perfil:\nNombre: ${this.usuarioActivo?.nombre}\nID: ${this.usuarioActivo?.num_empleado}\nRol: ${this.usuarioActivo?.rol}`);
  }

  cerrarSesion() {
    console.log("Cerrando sesión, destruyendo token y redirigiendo.");
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}