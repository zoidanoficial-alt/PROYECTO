package mx.tiempodegracia.app;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Tarea en segundo plano que revisa si hay eventos nuevos. */
public class EventsJobService extends JobService {

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            boolean retry = false;
            try {
                EventsCheck.run(getApplicationContext());
            } catch (Exception e) {
                retry = params.getJobId() == EventsCheck.JOB_NOW; // la periódica lo intentará en su siguiente vuelta
            }
            jobFinished(params, retry);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
