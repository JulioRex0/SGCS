import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-salas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './salas.html',
  styleUrl: './salas.css'
})

export class SalasComponent implements OnInit {
  salaId: string | null = null;
  rolUsuario: string = '';
  private apiUrl: string = '';
  infoSala: any = {};
  distribucion: any = {};
  asientosMapa: any = {};
  filas: string[] = [];

  mostrarModal: boolean = false;
  asientoSeleccionado: { fila: string; numero: number } | null = null;
  fotosCapturadas: File[] = [];
  previewsFotos: string[] = [];
  bloquearGuardado: boolean = false;

  fotoAmpliadaUrl: string | null = null;

  reporte: any = {
    descripcion: ''
  };

  opcionesReporte: any = {
    mantenimiento: false,
    sucio_asiento: false,
    sucio_portavaso: false,
    sucio_descanzabrazo: false,
    sucio_tachon: false
  };

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) {
    this.configurarApiDinamica();
  }

  private configurarApiDinamica() {
    const host = window.location.hostname;
    if (host.includes('devtunnels.ms')) {
      const hostBackend = host.replace('-4200', '-3000');
      this.apiUrl = `https://${hostBackend}/api`;
    } else {
      this.apiUrl = `http://${host}:3000/api`;
    }
  }

  ngOnInit() {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded: any = jwtDecode(token);
        this.rolUsuario = (decoded.rol || decoded.role || '').toLowerCase().trim();
      }
    } catch (error) {
      console.error('Error decodificando el token en salas:', error);
      this.rolUsuario = (localStorage.getItem('rol') || '').toLowerCase().trim();
    }

    this.route.params.subscribe(params => {
      this.salaId = params['id'] || this.route.parent?.snapshot.params['id'] || this.route.snapshot.paramMap.get('id');
      if (this.salaId) {
        this.cargarDatosSala();
        this.verificarYRecuperarModal();
      }
    });
  }

  verificarYRecuperarModal() {
    const backup = localStorage.getItem('sgcs_modal_recuperacion');
    if (backup) {
      try {
        const datos = JSON.parse(backup);
        if (datos.salaId === this.salaId) {
          this.asientoSeleccionado = datos.asientoSeleccionado;
          this.reporte = datos.reporte;
          this.opcionesReporte = datos.opcionesReporte;
          this.mostrarModal = true;

          console.log('Formulario recuperado tras cierre del navegador por falta de memoria.');
          localStorage.removeItem('sgcs_modal_recuperacion');
          this.cdr.detectChanges();
        }
      } catch (e) {
        console.error('Error al restaurar el estado del modal:', e);
      }
    }
  }

  async cargarDatosSala() {
    try {
      const token = localStorage.getItem('token');
      const respuestaSala = await fetch(`${this.apiUrl}/salas/${this.salaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const respuestaAsientos = await fetch(`${this.apiUrl}/asientos/sala/${this.salaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (respuestaSala.ok && respuestaAsientos.ok) {
        const datosSala = await respuestaSala.json();
        const datosAsientos = await respuestaAsientos.json();

        this.infoSala = datosSala.sala;
        this.distribucion = datosSala.sala.distribucion_filas;
        this.filas = Object.keys(this.distribucion).sort();
        this.asientosMapa = datosAsientos.asientos;

        this.cdr.detectChanges();
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
      if (this.salaId === '1') esDiscapacidad = (numero === 10 || numero === 11);
      else if (this.salaId === '5' || this.salaId === '6') esDiscapacidad = (numero === 7 || numero === 8);
      else esDiscapacidad = (numero === 6 || numero === 7);
    }

    if (esDiscapacidad && (!asientoStatus || asientoStatus.estado === 'limpio')) {
      return { clases: 'asiento discapacidad', texto: '♿' };
    }

    if (asientoStatus && asientoStatus.estado !== 'limpio') {
      const estadoStr = String(asientoStatus.estado).toLowerCase();
      const tieneMantenimiento = estadoStr.includes('mantenimiento');
      const tieneSuciedad = estadoStr.includes('sucio') || estadoStr.includes('mix');

      if (tieneMantenimiento && tieneSuciedad) {
        return { clases: 'asiento mixto-mantenimiento-sucio', texto: 'M/S' };
      }

      let label = numero.toString();
      if (asientoStatus.estado === 'mantenimiento') label = 'M';
      if (asientoStatus.estado === 'sucio-asiento') label = 'S/A';
      if (asientoStatus.estado === 'sucio-portavaso') label = 'S/P';
      if (asientoStatus.estado === 'sucio-descanzabrazo') label = 'S/D';
      if (asientoStatus.estado === 'sucio-tachon') label = 'S/T';

      return { clases: `asiento ${asientoStatus.estado}`, texto: label };
    }

    return { clases: 'asiento limpio', texto: numero.toString() };
  }

  interactuarAsiento(fila: string, numero: number) {
    this.asientoSeleccionado = { fila, numero };
    this.bloquearGuardado = false;

    this.opcionesReporte = {
      mantenimiento: false,
      sucio_asiento: false,
      sucio_portavaso: false,
      sucio_descanzabrazo: false,
      sucio_tachon: false
    };
    this.reporte.descripcion = '';
    this.fotosCapturadas = [];
    this.previewsFotos = [];

    const llave = `${fila}-${numero}`;
    const datosAsiento = this.asientosMapa && this.asientosMapa[llave];

    if (datosAsiento) {
      const lista: string[] = datosAsiento.incidencias || [];
      const tieneSuciedadActiva = lista.some(i => i && i.trim().toLowerCase().startsWith('sucio'));

      if (this.rolUsuario !== 'supervisor' && tieneSuciedadActiva) {
        this.bloquearGuardado = true;
      }

      if (datosAsiento.descripcion) {
        this.reporte.descripcion = datosAsiento.descripcion;
      }

      if (datosAsiento.url_fotos && datosAsiento.url_fotos.length > 0) {
        const baseHost = this.apiUrl.replace('/api', '');
        this.previewsFotos = datosAsiento.url_fotos.map((path: string) => `${baseHost}/${path}`);
      }

      if (lista.includes('mantenimiento')) this.opcionesReporte.mantenimiento = true;
      if (lista.includes('sucio-asiento')) this.opcionesReporte.sucio_asiento = true;
      if (lista.includes('sucio-portavaso')) this.opcionesReporte.sucio_portavaso = true;
      if (lista.includes('sucio-descanzabrazo')) this.opcionesReporte.sucio_descanzabrazo = true;
      if (lista.includes('sucio-tachon')) this.opcionesReporte.sucio_tachon = true;
    }

    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.asientoSeleccionado = null;
    this.fotosCapturadas = [];
    this.previewsFotos = [];
    localStorage.removeItem('sgcs_modal_recuperacion');
    this.cdr.detectChanges();
  }

  
  private comprimirImagen(archivo: File, calidad: number = 0.7): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(archivo);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No se pudo obtener el contexto del canvas'));

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const archivoComprimido = new File([blob], archivo.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(archivoComprimido);
            } else {
              reject(new Error('Error al generar blob de imagen'));
            }
          }, 'image/jpeg', calidad);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  }

  async capturarFoto(event: any) {
    if (this.asientoSeleccionado) {
      const estadoGuardado = {
        salaId: this.salaId,
        asientoSeleccionado: this.asientoSeleccionado,
        reporte: this.reporte,
        opcionesReporte: this.opcionesReporte
      };
      localStorage.setItem('sgcs_modal_recuperacion', JSON.stringify(estadoGuardado));
    }

    const archivos: FileList = event.target.files;
    if (archivos && archivos.length > 0) {
      const listaArchivos = Array.from(archivos);
      
      for (const archivo of listaArchivos) {
        try {
          const fotoComprimida = await this.comprimirImagen(archivo, 0.7);
          this.fotosCapturadas.push(fotoComprimida);

          const reader = new FileReader();
          reader.onload = () => {
            this.previewsFotos.push(reader.result as string);
            localStorage.removeItem('sgcs_modal_recuperacion');
            this.cdr.detectChanges();
          };
          reader.readAsDataURL(fotoComprimida);
        } catch (error) {
          console.error('Error al comprimir foto individual, usando original:', error);
          this.fotosCapturadas.push(archivo);
          
          const reader = new FileReader();
          reader.onload = () => {
            this.previewsFotos.push(reader.result as string);
            localStorage.removeItem('sgcs_modal_recuperacion');
            this.cdr.detectChanges();
          };
          reader.readAsDataURL(archivo);
        }
      }
    }
  }

  async quitarFoto(index: number) {
    if (!this.asientoSeleccionado) return;

    const llave = `${this.asientoSeleccionado.fila}-${this.asientoSeleccionado.numero}`;
    const datosAsiento = this.asientosMapa && this.asientosMapa[llave];

    if (datosAsiento) {
      const lista: string[] = datosAsiento.incidencias || [];
      const tieneSuciedadActiva = lista.some(i => i && i.trim().toLowerCase().startsWith('sucio'));

      if (this.rolUsuario !== 'supervisor' && tieneSuciedadActiva) {
        alert('Acción no permitida. Las evidencias de butacas con suciedad solo pueden ser modificadas por un supervisor.');
        return;
      }
    }

    const fotoUrl = this.previewsFotos[index];
    this.previewsFotos.splice(index, 1);

    if (fotoUrl.startsWith('data:image')) {
      const nuevasFotosPrevias = this.previewsFotos.filter(p => p.startsWith('data:image'));
      this.fotosCapturadas = this.fotosCapturadas.filter((_, idx) => idx < nuevasFotosPrevias.length);
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('salaId', this.salaId || '');
      formData.append('fila', this.asientoSeleccionado.fila);
      formData.append('numero', this.asientoSeleccionado.numero.toString());
      formData.append('descripcion', this.reporte.descripcion);

      const incidenciasSeleccionadas: string[] = [];
      if (this.opcionesReporte.mantenimiento) incidenciasSeleccionadas.push('mantenimiento');
      if (this.opcionesReporte.sucio_asiento) incidenciasSeleccionadas.push('sucio-asiento');
      if (this.opcionesReporte.sucio_portavaso) incidenciasSeleccionadas.push('sucio-portavaso');
      if (this.opcionesReporte.sucio_descanzabrazo) incidenciasSeleccionadas.push('sucio-descanzabrazo');
      if (this.opcionesReporte.sucio_tachon) incidenciasSeleccionadas.push('sucio-tachon');

      formData.append('incidencias', JSON.stringify(incidenciasSeleccionadas));
      formData.append('eliminarFotosExistentes', 'true');

      this.fotosCapturadas.forEach(foto => formData.append('fotos', foto, foto.name));

      const respuesta = await fetch(`${this.apiUrl}/asientos/reportar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (respuesta.ok) {
        await this.cargarDatosSala();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al intentar remover la foto:', error);
    }

    this.cdr.detectChanges();
  }

  async liberarButacaIndividual() {
    if (!this.asientoSeleccionado || this.rolUsuario !== 'supervisor') return;

    const seguro = confirm(`¿Estás seguro de que deseas marcar como limpia la butaca ${this.asientoSeleccionado.fila}-${this.asientoSeleccionado.numero}? Esto eliminará todo reporte e imágenes asociadas.`);
    if (!seguro) return;

    try {
      const token = localStorage.getItem('token');
      const respuesta = await fetch(`${this.apiUrl}/asientos/liberar-butaca`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          salaId: this.salaId,
          fila: this.asientoSeleccionado.fila,
          numero: this.asientoSeleccionado.numero
        })
      });

      if (respuesta.ok) {
        this.cerrarModal();
        await this.cargarDatosSala();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al conectar con la API de liberación:', error);
    }
  }

  async guardarReporte() {
    if (!this.asientoSeleccionado) return;

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('salaId', this.salaId || '');
      formData.append('fila', this.asientoSeleccionado.fila);
      formData.append('numero', this.asientoSeleccionado.numero.toString());
      formData.append('descripcion', this.reporte.descripcion);

      const incidenciasSeleccionadas: string[] = [];
      if (this.opcionesReporte.mantenimiento) incidenciasSeleccionadas.push('mantenimiento');
      if (this.opcionesReporte.sucio_asiento) incidenciasSeleccionadas.push('sucio-asiento');
      if (this.opcionesReporte.sucio_portavaso) incidenciasSeleccionadas.push('sucio-portavaso');
      if (this.opcionesReporte.sucio_descanzabrazo) incidenciasSeleccionadas.push('sucio-descanzabrazo');
      if (this.opcionesReporte.sucio_tachon) incidenciasSeleccionadas.push('sucio-tachon');

      if (incidenciasSeleccionadas.length === 0) {
        incidenciasSeleccionadas.push('limpio');
      }

      formData.append('incidencias', JSON.stringify(incidenciasSeleccionadas));

      if (this.fotosCapturadas.length > 0) {
        this.fotosCapturadas.forEach(foto => formData.append('fotos', foto, foto.name));
      }

      const respuesta = await fetch(`${this.apiUrl}/asientos/reportar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (respuesta.ok) {
        this.cerrarModal();
        await this.cargarDatosSala();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al guardar el reporte:', error);
    }
  }

  abrirZoomFoto(url: string) {
    this.fotoAmpliadaUrl = url;
    this.cdr.detectChanges();
  }

  cerrarZoomFoto() {
    this.fotoAmpliadaUrl = null;
    this.cdr.detectChanges();
  }

  confirmarLiberacionSala() {
    if (this.rolUsuario !== 'supervisor') return;
    const seguro = confirm('¿Estás seguro de que deseas liberar toda la sala? Esto quitará todas las marcas de suciedad, pero mantendrá intactas las butacas en mantenimiento.');
    if (seguro) {
      this.ejecutarLiberacionSala();
    }
  }

  async ejecutarLiberacionSala() {
    try {
      const token = localStorage.getItem('token');
      const respuesta = await fetch(`${this.apiUrl}/asientos/sala/${this.salaId}/liberar`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (respuesta.ok) {
        alert('Sala liberada con éxito. Los asientos sucios han sido limpiados y los archivos de imagen han sido purgados.');
        await this.cargarDatosSala();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
    }
  }
}