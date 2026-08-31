-- Третье состояние задачи: «провалена» — в дополнение к pending/done.
-- pending теперь означает «не отмечено» (ни выполнена, ни провалена), а не «не выполнена».
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'done', 'failed'));
