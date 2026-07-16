import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  imports: [CommonModule, RouterModule, RouterOutlet, BaseChartDirective, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  salaSeleccionada: number | null = null;
  salas: Sala[] = [];
  menuColapsado: boolean = true;
  usuarioActivo: any = null;
  public filtroMantenimiento: boolean = true;
  public filtroSucio: boolean = true;
  private datosSalasOriginales: any[] = [];
  private apiUrl: string = '';
  ultimasActividades: any[] = [];

  // Variables para la gestión del modal de reportes con filtros por estado y sala
  public mostrarModalReporte: boolean = false;
  public listaUsuariosReporte: any[] = [];
  public criterioReporte = {
    tipo: 'registradas',
    fechaInicio: '',
    fechaFin: '',
    salaId: 'todas',
    usuarioId: 'todos'
  };

  // --- CONFIGURACIÓN GRÁFICA DE BARRAS ---
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      x: { stacked: true },
      y: { min: 0, stacked: true } 
    },
    plugins: { 
      legend: { display: true, position: 'top' } 
    }
  };
  
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  // --- CONFIGURACIÓN GRÁFICA DE PASTEL ---
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
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
      const resBarras = await fetch(`${this.apiUrl}/asientos/dashboard/salas-incidencias`, { headers });
      if (resBarras.ok) {
        this.datosSalasOriginales = await resBarras.json();
        this.aplicarFiltrosGrafica();
      }

      const resPastel = await fetch(`${this.apiUrl}/asientos/dashboard/estatus-activos`, { headers });
      if (resPastel.ok) {
        const datos = await resPastel.json();
        this.pieChartData = {
          labels: ['En Mantenimiento', 'Sucios'],
          datasets: [{
            data: [datos.mantenimiento, datos.sucio],
            backgroundColor: ['#f59e0b', '#ef4444']
          }]
        };
      }

      const resTabla = await fetch(`${this.apiUrl}/asientos/dashboard/ultimas-actividades`, { headers });
      if (resTabla.ok) {
        this.ultimasActividades = await resTabla.json();
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al poblar las métricas del dashboard:', error);
    }
  }

  aplicarFiltrosGrafica() {
    const labels = this.datosSalasOriginales.map((d: any) => d.sala);
    const datasets: any[] = [];

    if (this.filtroMantenimiento) {
      datasets.push({
        data: this.datosSalasOriginales.map((d: any) => parseInt(d.mantenimiento || 0, 10)),
        label: 'Mantenimiento',
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        borderWidth: 1
      });
    }

    if (this.filtroSucio) {
      datasets.push({
        data: this.datosSalasOriginales.map((d: any) => parseInt(d.sucios || 0, 10)),
        label: 'Suciedad',
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 1
      });
    }

    if (datasets.length === 0) {
      this.barChartData = {
        labels: labels,
        datasets: [{ data: labels.map(() => 0), label: 'Sin incidencias', backgroundColor: '#e2e8f0' }]
      };
    } else {
      this.barChartData = {
        labels: labels,
        datasets: datasets
      };
    }

    this.cdr.detectChanges();
    this.chart?.update();
  }

  abrirModalReporte() {
    this.mostrarModalReporte = true;
    this.obtenerUsuariosParaFiltro();
    
    const hoy = new Date();
    const haceUnaSemana = new Date();
    haceUnaSemana.setDate(hoy.getDate() - 7);
    
    this.criterioReporte.fechaInicio = haceUnaSemana.toISOString().slice(0, 16);
    this.criterioReporte.fechaFin = hoy.toISOString().slice(0, 16);
  }

  cerrarModalReporte() {
    this.mostrarModalReporte = false;
  }

  async obtenerUsuariosParaFiltro() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${this.apiUrl}/usuarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) this.listaUsuariosReporte = await res.json();
    } catch (e) {
      console.error('Error cargando catálogo de usuarios:', e);
    }
  }

  obtenerBase64DesdeUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('No se pudo obtener el contexto del canvas'));
        }
      };
      img.onerror = (error) => reject(error);
    });
  }

async exportarReportePDF() {
    const token = localStorage.getItem('token');
    try {
      const queryParams = new URLSearchParams(this.criterioReporte).toString();
      const res = await fetch(`${this.apiUrl}/asientos/dashboard/exportar-reporte?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Error al obtener datos');
      const datosReporte = await res.json();

      const doc = new jsPDF('p', 'mm', 'letter');
      
      doc.setFillColor(11, 47, 97);
      doc.rect(0, 0, 216, 25, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('SGCS - SISTEMA DE GESTIÓN DE CONTROL DE SALAS', 15, 16);
      
      try {
        const img = new Image();
        img.src = 'assets/logo-cinepolis.png';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        doc.addImage(img, 'PNG', 175, 4, 26, 17);
      } catch (imgError) {
        console.warn('No se pudo incrustar el logotipo físico en el PDF:', imgError);
      }

      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      
      let tituloReporte = 'Incidencias Registradas (Abiertas)';
      if (this.criterioReporte.tipo === 'liberadas') tituloReporte = 'Incidencias Liberadas (Limpias/Listas)';
      if (this.criterioReporte.tipo === 'mantenimientos') tituloReporte = 'Historial de Mantenimientos Técnicos';

      doc.text(`Reporte: ${tituloReporte}`, 15, 35);
      doc.text(`Periodo: ${this.criterioReporte.fechaInicio.replace('T',' ')} a ${this.criterioReporte.fechaFin.replace('T',' ')}`, 15, 41);
      
      const columnas = ['Entidad / Personal', 'Sala', 'Resumen / Actividades Realizadas', 'Fecha y Hora'];
      const filas = datosReporte.map((item: any) => [
        item.usuario || 'N/A',
        item.id_sala === 'Todas' ? 'Todas' : `Sala ${item.id_sala}`,
        item.detalle || 'Sin registro',
        item.fecha ? this.formatearFecha(item.fecha) : 'Sin registros'
      ]);

      autoTable(doc, {
        startY: 48,
        head: [columnas],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [11, 47, 97], fontStyle: 'bold' },
        styles: { font: 'Helvetica', fontSize: 9 }
      });

      doc.save(`SGCS_Reporte_${this.criterioReporte.tipo}_${Date.now()}.pdf`);
      this.cerrarModalReporte();
    } catch (error) {
      alert('Error al generar el PDF corporativo.');
      console.error(error);
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
  }

  irADatosGenerales() {
    this.salaSeleccionada = null;
    this.menuColapsado = false;
    this.router.navigate(['/dashboard']);
    this.cargarDatosDashboard();
  }

  verDatosUsuario() {
    alert(`Perfil:\nNombre: ${this.usuarioActivo?.nombre}\nID: ${this.usuarioActivo?.num_empleado}\nRol: ${this.usuarioActivo?.rol}`);
  }

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}