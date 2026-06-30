import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-salas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './salas.html',
  styleUrl: './salas.css'
})
export class SalasComponent implements OnInit {
  salaId: string | null = null;

  infoSala: any = {};
  distribucion: any = {};
  asientosMapa: any = {};
  filas: string[] = [];

  mostrarModal: boolean = false;
  asientoSeleccionado: { fila: string; numero: number } | null = null;
  fotoCapturada: File | null = null;
  previewFoto: string | null = null;

  reporte: any = {
    estado: 'limpio',
    descripcion: ''
  };

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.salaId = params['id'] || this.route.parent?.snapshot.params['id'] || this.route.snapshot.paramMap.get('id');

      console.log('ID de sala detectado en el componente hijo:', this.salaId);

      if (this.salaId) {
        this.cargarDatosSala();
      }
    });
  }

  async cargarDatosSala() {
    try {
      const token = localStorage.getItem('token');
      const currentHost = window.location.hostname;

      // 1. Consultamos la estructura base de la sala (filas, distribución)
      const respuestaSala = await fetch(`http://${currentHost}:3000/api/salas/${this.salaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // 🚀 2. Consultamos tus nuevos estados dinámicos desde /api/asientos/sala/:id
      const respuestaAsientos = await fetch(`http://${currentHost}:3000/api/asientos/sala/${this.salaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (respuestaSala.ok && respuestaAsientos.ok) {
        const datosSala = await respuestaSala.json();
        const datosAsientos = await respuestaAsientos.json();

        // Asignamos la estructura estructural fija
        this.infoSala = datosSala.sala;
        this.distribucion = datosSala.sala.distribucion_filas;
        this.filas = Object.keys(this.distribucion).sort();

        // 🚀 Reemplazamos el mapa con el objeto indexado 'asientosMapa' que genera tu nuevo endpoint
        this.asientosMapa = datosAsientos.asientos;

        console.log('Datos estructurales y mapa de estados cargados con éxito.');
        this.cdr.detectChanges(); // Forzamos el redibujado de las butacas con sus nuevos colores
      } else {
        console.error('Hubo un error al sincronizar los datos de la sala o sus asientos');
      }
    } catch (error) {
      console.error('Error al obtener la configuración de la sala:', error);
    }
  }

  getNumerosAsientos(fila: string): number[] {
    const max = this.distribucion[fila] || 22;

    if (this.salaId === '4' || this.salaId === '8') {
      return Array.from({ length: max }, (_, i) => i + 1);
    }

    return Array.from({ length: max }, (_, i) => max - i);
  }

  obtenerDatosAsiento(fila: string, numero: number): { clases: string; texto: string } {
    const llave = `${fila}-${numero}`;
    const asientoStatus = this.asientosMapa[llave];

    let esDiscapacidad = false;

    if (fila === 'A') {
      if (this.salaId === '1') {
        esDiscapacidad = (numero === 10 || numero === 11);
      } else if (this.salaId === '5' || this.salaId === '6') {
        esDiscapacidad = (numero === 7 || numero === 8);
      } else {
        esDiscapacidad = (numero === 6 || numero === 7);
      }
    }

    if (esDiscapacidad && (!asientoStatus || asientoStatus.estado === 'limpio')) {
      return { clases: 'asiento discapacidad', texto: '♿' };
    }

    if (asientoStatus && asientoStatus.estado !== 'limpio') {
      let label = numero.toString();
      if (asientoStatus.estado === 'mantenimiento') label = 'M';
      if (asientoStatus.estado === 'sucio-asiento') label = 'S/A';
      if (asientoStatus.estado === 'sucio-portavaso') label = 'S/P';
      if (asientoStatus.estado === 'sucio-descanzabrazo') label = 'S/D';
      if (asientoStatus.estado === 'sucio-tachon') label = 'S/T';

      return {
        clases: `asiento ${asientoStatus.estado}`,
        texto: label
      };
    }

    return { clases: 'asiento limpio', texto: numero.toString() };
  }

  interactuarAsiento(fila: string, numero: number) {
    console.log(`Abriendo menú de reporte para: Sala ${this.salaId} -> ${fila}-${numero}`);

    this.asientoSeleccionado = { fila, numero };
    const llave = `${fila}-${numero}`;
    const asientoStatus = this.asientosMapa[llave];

    this.reporte = {
      estado: asientoStatus ? asientoStatus.estado : 'limpio',
      descripcion: asientoStatus?.descripcion || ''
    };

    this.previewFoto = asientoStatus?.foto_url || null;
    this.fotoCapturada = null;
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.asientoSeleccionado = null;
    this.fotoCapturada = null;
    this.previewFoto = null;
    this.cdr.detectChanges();
  }

  capturarFoto(event: any) {
    const archivo = event.target.files[0];
    if (archivo) {
      this.fotoCapturada = archivo;

      const reader = new FileReader();
      reader.onload = () => {
        this.previewFoto = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(archivo);
    }
  }

  quitarFoto() {
    this.fotoCapturada = null;
    this.previewFoto = null;
  }

  async guardarReporte() {
    if (!this.asientoSeleccionado) return;

    try {
      const token = localStorage.getItem('token');
      const currentHost = window.location.hostname;

      const formData = new FormData();
      formData.append('salaId', this.salaId || '');
      formData.append('fila', this.asientoSeleccionado.fila);
      formData.append('numero', this.asientoSeleccionado.numero.toString());
      formData.append('estado', this.reporte.estado);
      formData.append('descripcion', this.reporte.descripcion);

      const incidenciasSeleccionadas = [this.reporte.estado]; 
      formData.append('incidencias', JSON.stringify(incidenciasSeleccionadas));

      if (this.fotoCapturada) {
        formData.append('foto', this.fotoCapturada, this.fotoCapturada.name);
      }

      const respuesta = await fetch(`http://${currentHost}:3000/api/asientos/reportar`, {
        method: 'POST',
        headers: {'Authorization': `Bearer ${token}`},
        body: formData
      });

      if (respuesta.ok) {
        console.log('Reporte de butaca guardado exitosamente.');
        this.cerrarModal();
        this.cargarDatosSala();
      } else {
        console.error('El backend reportó un error al guardar la incidencia.');
      }
    } catch (error) {
      console.error('Error de red al intentar guardar el reporte:', error);
    }
  }
}